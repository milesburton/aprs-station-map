import type { IncomingMessage, ServerResponse } from 'node:http'
import { buildSchema, graphql } from 'graphql'
import { config } from './config'
import {
  type DbStation,
  getAllStationHistories,
  getAllStations,
  getStationByCallsign,
  getStationHistory,
  getStats,
} from './database'
import { calculateBearing, calculateDistance } from './geo'
import { stateManager } from './state-manager'

const schema = buildSchema(`
  type Query {
    """Fetch all stations, optionally filtered by callsign prefix or limited to stations with position."""
    stations(
      search: String
      withPositionOnly: Boolean
      limit: Int
    ): [Station!]!

    """Fetch a single station by exact callsign (case-insensitive)."""
    station(callsign: String!): Station

    """Fetch packet history for a station (most-recent first)."""
    stationHistory(callsign: String!, limit: Int): [PacketHistory!]!

    """Fetch all recent position trails grouped by callsign."""
    trails(maxAgeHours: Int, limitPerStation: Int): [StationTrail!]!

    """Aggregate statistics."""
    stats: Stats!

    """Server health and connection status."""
    health: Health!
  }

  type Station {
    callsign: String!
    latitude: Float
    longitude: Float
    symbol: String!
    symbolTable: String!
    comment: String!
    lastHeard: String!
    packetCount: Int!
    lastPath: String!

    """Distance from base station in kilometres (null if no position)."""
    distanceKm: Float

    """Bearing from base station in degrees (null if no position)."""
    bearingDeg: Float

    """Digipeater path as list of callsigns."""
    via: [String!]!
  }

  type PacketHistory {
    id: Int!
    rawPacket: String!
    latitude: Float
    longitude: Float
    path: String!
    receivedAt: String!
  }

  type StationTrail {
    callsign: String!
    points: [TrailPoint!]!
  }

  type TrailPoint {
    latitude: Float!
    longitude: Float!
    receivedAt: String!
  }

  type Stats {
    totalStations: Int!
    stationsWithPosition: Int!
    totalPackets: Int!
    kissConnected: Boolean!
  }

  type Health {
    status: String!
    kissConnected: Boolean!
    connectedClients: Int
  }
`)

const stationLocation = {
  latitude: config.station.latitude,
  longitude: config.station.longitude,
}

const toGqlStation = (db: DbStation) => {
  const coords =
    db.latitude !== null && db.longitude !== null
      ? { latitude: db.latitude, longitude: db.longitude }
      : null

  return {
    callsign: db.callsign,
    latitude: db.latitude,
    longitude: db.longitude,
    symbol: db.symbol,
    symbolTable: db.symbol_table,
    comment: db.comment,
    lastHeard: new Date(db.last_heard).toISOString(),
    packetCount: db.packet_count,
    lastPath: db.last_path,
    distanceKm: coords ? calculateDistance(stationLocation, coords) : null,
    bearingDeg: coords ? calculateBearing(stationLocation, coords) : null,
    via: db.last_path ? db.last_path.split(',').filter(Boolean) : [],
  }
}

const resolvers = {
  stations: (args: { search?: string; withPositionOnly?: boolean; limit?: number }) => {
    let stations = getAllStations()
    if (args.search) {
      const q = args.search.toUpperCase()
      stations = stations.filter((s) => s.callsign.toUpperCase().includes(q))
    }
    if (args.withPositionOnly) {
      stations = stations.filter((s) => s.latitude !== null && s.longitude !== null)
    }
    if (args.limit) {
      stations = stations.slice(0, args.limit)
    }
    return stations.map(toGqlStation)
  },

  station: (args: { callsign: string }) => {
    const db = getStationByCallsign(args.callsign.toUpperCase())
    return db ? toGqlStation(db) : null
  },

  stationHistory: (args: { callsign: string; limit?: number }) => {
    const station = getStationByCallsign(args.callsign.toUpperCase())
    if (!station) return []
    return getStationHistory(station.id, args.limit ?? 100).map((h) => ({
      id: h.id,
      rawPacket: h.raw_packet,
      latitude: h.latitude,
      longitude: h.longitude,
      path: h.path,
      receivedAt: new Date(h.received_at).toISOString(),
    }))
  },

  trails: (args: { maxAgeHours?: number; limitPerStation?: number }) => {
    const histories = getAllStationHistories(args.maxAgeHours ?? 24, args.limitPerStation ?? 50)
    return Object.entries(histories).map(([callsign, packets]) => ({
      callsign,
      points: packets
        .filter((p) => p.latitude !== null && p.longitude !== null)
        .map((p) => ({
          latitude: p.latitude as number,
          longitude: p.longitude as number,
          receivedAt: new Date(p.received_at).toISOString(),
        })),
    }))
  },

  stats: () => ({
    ...getStats(),
    kissConnected: stateManager.isKissConnected(),
  }),

  health: () => ({
    status: 'ok',
    kissConnected: stateManager.isKissConnected(),
    connectedClients: null, // caller fills in if needed
  }),
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

type GraphQLRequest = { source: string; variableValues?: Record<string, unknown> }
type ParseResult =
  | { ok: true; value: GraphQLRequest }
  | { ok: false; status: number; message: string }

const parseGetRequest = (req: IncomingMessage): ParseResult => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
  const query = url.searchParams.get('query')
  if (!query) return { ok: false, status: 400, message: 'Missing query parameter' }
  const vars = url.searchParams.get('variables')
  if (vars) {
    try {
      return {
        ok: true,
        value: { source: query, variableValues: JSON.parse(vars) as Record<string, unknown> },
      }
    } catch {
      return { ok: false, status: 400, message: 'Invalid variables JSON' }
    }
  }
  return { ok: true, value: { source: query } }
}

const parsePostRequest = async (req: IncomingMessage): Promise<ParseResult> => {
  const body = await new Promise<string>((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: Buffer) => {
      data += chunk.toString()
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
  let parsed: { query?: string; variables?: Record<string, unknown> }
  try {
    parsed = JSON.parse(body) as typeof parsed
  } catch {
    return { ok: false, status: 400, message: 'Invalid JSON body' }
  }
  if (!parsed.query) return { ok: false, status: 400, message: 'Missing query in request body' }
  return { ok: true, value: { source: parsed.query, variableValues: parsed.variables } }
}

/**
 * Handle a GraphQL request over plain Node HTTP.
 * Supports both GET (query param) and POST (JSON body) requests.
 * Mount at /graphql in the HTTP request handler.
 */
export const handleGraphQL = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders)
    res.end()
    return
  }

  const sendJson = (data: unknown, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders })
    res.end(JSON.stringify(data))
  }

  try {
    let parseResult: ParseResult
    if (req.method === 'GET') {
      parseResult = parseGetRequest(req)
    } else if (req.method === 'POST') {
      parseResult = await parsePostRequest(req)
    } else {
      sendJson({ errors: [{ message: 'Method not allowed' }] }, 405)
      return
    }

    if (!parseResult.ok) {
      sendJson({ errors: [{ message: parseResult.message }] }, parseResult.status)
      return
    }

    const result = await graphql({
      schema,
      source: parseResult.value.source,
      rootValue: resolvers,
      variableValues: parseResult.value.variableValues,
    })
    sendJson(result)
  } catch (error) {
    console.error('[GraphQL] Error:', error)
    sendJson({ errors: [{ message: 'Internal server error' }] }, 500)
  }
}
