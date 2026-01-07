import type { ServerWebSocket } from 'bun'
import { bytesToHex, parseAprsPacket } from './aprs-parser'
import { config } from './config'
import {
  type DbStation,
  cleanupOldHistory,
  closeDatabase,
  getAllStations,
  getStationByCallsign,
  getStationHistory,
  getStats,
  initializeDatabase,
  upsertStation,
} from './database'
import { calculateBearing, calculateDistance } from './geo'
import { closeKissClient, getKissClient } from './kiss-client'
import { type StateEvent, stateManager } from './state-manager'

interface WebSocketData {
  id: string
}

// Track connected WebSocket clients
const clients = new Set<ServerWebSocket<WebSocketData>>()

// Convert DB station to API station format
const toApiStation = (dbStation: DbStation) => {
  const stationLocation = {
    latitude: config.station.latitude,
    longitude: config.station.longitude,
  }

  const coords =
    dbStation.latitude && dbStation.longitude
      ? { latitude: dbStation.latitude, longitude: dbStation.longitude }
      : null

  return {
    callsign: dbStation.callsign,
    coordinates: coords,
    symbol: dbStation.symbol,
    comment: dbStation.comment,
    lastHeard: new Date(dbStation.last_heard).toISOString(),
    distance: coords ? calculateDistance(stationLocation, coords) : null,
    bearing: coords ? calculateBearing(stationLocation, coords) : null,
    packetCount: dbStation.packet_count,
  }
}

// Broadcast to all connected clients
const broadcast = (event: StateEvent): void => {
  const message = JSON.stringify(event)
  for (const client of clients) {
    try {
      client.send(message)
    } catch (error) {
      console.error('[WS] Failed to send to client:', error)
      clients.delete(client)
    }
  }
}

// Subscribe to state events and broadcast
stateManager.on('state', (event: StateEvent) => {
  if (event.type === 'station_update') {
    broadcast({
      ...event,
      station: toApiStation(event.station) as unknown as DbStation,
    })
  } else {
    broadcast(event)
  }
})

// API route handlers
const handleApiRequest = async (req: Request, url: URL): Promise<Response> => {
  const path = url.pathname.replace('/api', '')
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // GET /api/stations
    if (path === '/stations' && req.method === 'GET') {
      const stations = getAllStations().map(toApiStation)
      return Response.json({ stations }, { headers: corsHeaders })
    }

    // GET /api/stations/:callsign
    const stationMatch = path.match(/^\/stations\/([^/]+)$/)
    if (stationMatch && req.method === 'GET') {
      const callsign = decodeURIComponent(stationMatch[1] ?? '')
      const station = getStationByCallsign(callsign)
      if (!station) {
        return Response.json({ error: 'Station not found' }, { status: 404, headers: corsHeaders })
      }
      const history = getStationHistory(station.id)
      return Response.json(
        {
          station: toApiStation(station),
          history: history.map((h) => ({
            raw: h.raw_packet,
            latitude: h.latitude,
            longitude: h.longitude,
            path: h.path,
            receivedAt: new Date(h.received_at).toISOString(),
          })),
        },
        { headers: corsHeaders }
      )
    }

    // GET /api/stats
    if (path === '/stats' && req.method === 'GET') {
      const stats = getStats()
      return Response.json(
        {
          ...stats,
          kissConnected: stateManager.isKissConnected(),
        },
        { headers: corsHeaders }
      )
    }

    // GET /api/health
    if (path === '/health' && req.method === 'GET') {
      return Response.json(
        {
          status: 'ok',
          kissConnected: stateManager.isKissConnected(),
          connectedClients: clients.size,
        },
        { headers: corsHeaders }
      )
    }

    return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders })
  } catch (error) {
    console.error('[API] Error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders })
  }
}

// Start the server
export const startServer = async (): Promise<void> => {
  // Initialize database
  initializeDatabase()

  // Start KISS client
  const kissClient = getKissClient()

  kissClient.on('connected', () => {
    stateManager.emitKissConnected()
  })

  kissClient.on('disconnected', () => {
    stateManager.emitKissDisconnected()
  })

  kissClient.on('packet', (packet: Uint8Array) => {
    try {
      const parsed = parseAprsPacket(packet)
      if (parsed) {
        console.log(
          `[APRS] ${parsed.source} > ${parsed.destination}: ${parsed.comment || parsed.raw.slice(0, 50)}`
        )

        const existingStation = getStationByCallsign(parsed.source)
        const isNew = !existingStation
        const station = upsertStation(parsed)

        stateManager.emitStationUpdate(station, isNew)
      }
    } catch (error) {
      console.error('[APRS] Parse error:', error, bytesToHex(packet))
    }
  })

  kissClient.on('error', (error) => {
    console.error('[KISS] Error:', error.message)
  })

  // Connect to KISS TNC
  await kissClient.connect()

  // Schedule periodic cleanup
  setInterval(
    () => {
      const deleted = cleanupOldHistory(7)
      if (deleted > 0) {
        console.log(`[DB] Cleaned up ${deleted} old history records`)
      }
    },
    24 * 60 * 60 * 1000
  ) // Daily

  // Periodically broadcast stats
  setInterval(() => {
    stateManager.emitStatsUpdate(getStats())
  }, 30000)

  // Start HTTP + WebSocket server
  const server = Bun.serve<WebSocketData>({
    hostname: config.web.host,
    port: config.web.port,

    async fetch(req, server) {
      const url = new URL(req.url)

      // WebSocket upgrade
      if (url.pathname === '/ws') {
        const upgraded = server.upgrade(req, {
          data: { id: crypto.randomUUID() },
        })
        if (upgraded) return undefined
        return new Response('WebSocket upgrade failed', { status: 400 })
      }

      // API routes
      if (url.pathname.startsWith('/api')) {
        return handleApiRequest(req, url)
      }

      return new Response('Not found', { status: 404 })
    },

    websocket: {
      open(ws) {
        clients.add(ws)
        console.log(`[WS] Client connected (${clients.size} total)`)

        // Send initial state
        const stations = getAllStations().map(toApiStation)
        const stats = getStats()
        ws.send(
          JSON.stringify({
            type: 'init',
            stations,
            stats: {
              ...stats,
              kissConnected: stateManager.isKissConnected(),
            },
          })
        )
      },

      message(_ws, message) {
        // Handle client messages if needed
        try {
          const data = JSON.parse(message.toString())
          console.log('[WS] Received:', data)
        } catch {
          // Ignore invalid messages
        }
      },

      close(ws) {
        clients.delete(ws)
        console.log(`[WS] Client disconnected (${clients.size} remaining)`)
      },
    },
  })

  console.log(`[Server] Listening on ${server.hostname}:${server.port}`)

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[Server] Shutting down...')
    closeKissClient()
    closeDatabase()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    console.log('\n[Server] Shutting down...')
    closeKissClient()
    closeDatabase()
    process.exit(0)
  })
}

// Run if executed directly
if (import.meta.main) {
  startServer()
}
