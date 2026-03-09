import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { closeAisClient, getAisClient } from './ais-client'
import { closeAprsIsClient, getAprsIsClient } from './aprs-is-client'
import { parseAprsIsPacket } from './aprs-is-parser'
import { bytesToHex, parseAprsPacket } from './aprs-parser'
import { config } from './config'
import {
  cleanupOldHistory,
  closeDatabase,
  type DbStation,
  type DbVessel,
  getAllStationHistories,
  getAllStations,
  getAllVessels,
  getStationByCallsign,
  getStationHistory,
  getStats,
  initializeDatabase,
  upsertStation,
  upsertVessel,
} from './database'
import { calculateBearing, calculateDistance } from './geo'
import { handleGraphQL } from './graphql'
import { closeKissClient, getKissClient } from './kiss-client'
import { SpectrumAnalyzer } from './spectrum-analyzer'
import { type StateEvent, stateManager } from './state-manager'

interface WebSocketWithId extends WebSocket {
  id: string
}

// Track connected WebSocket clients
const clients = new Set<WebSocketWithId>()
let aprsIsConnected = false

// Read version from package.json
let APP_VERSION = '1.0.0' // fallback
for (const candidate of [
  '/app/package.json',
  new URL('../../package.json', import.meta.url).pathname,
]) {
  try {
    const packageJson = JSON.parse(readFileSync(candidate, 'utf-8'))
    APP_VERSION = packageJson.version as string
    console.log(`[Version] Loaded version ${APP_VERSION}`)
    break
  } catch {
    // try next candidate
  }
}

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
    symbolTable: dbStation.symbol_table,
    comment: dbStation.comment,
    lastHeard: new Date(dbStation.last_heard).toISOString(),
    distance: coords ? calculateDistance(stationLocation, coords) : null,
    bearing: coords ? calculateBearing(stationLocation, coords) : null,
    packetCount: dbStation.packet_count,
    via: dbStation.last_path ? dbStation.last_path.split(',').filter(Boolean) : [],
  }
}

// Convert DB vessel to API vessel format
const toApiVessel = (dbVessel: Awaited<ReturnType<typeof getAllVessels>>[number]) => {
  const stationLocation = {
    latitude: config.station.latitude,
    longitude: config.station.longitude,
  }

  const coords =
    dbVessel.latitude && dbVessel.longitude
      ? { latitude: dbVessel.latitude, longitude: dbVessel.longitude }
      : null

  return {
    mmsi: dbVessel.mmsi,
    callsign: dbVessel.callsign || '',
    shipName: dbVessel.ship_name || '',
    coordinates: coords,
    course: dbVessel.course ?? undefined,
    speed: dbVessel.speed ?? undefined,
    heading: dbVessel.heading ?? undefined,
    shipType: dbVessel.ship_type ?? undefined,
    lastHeard: new Date(dbVessel.last_heard).toISOString(),
    distance: coords ? calculateDistance(stationLocation, coords) : null,
    bearing: coords ? calculateBearing(stationLocation, coords) : null,
    packetCount: dbVessel.packet_count,
  }
}

// Broadcast to all connected clients
const broadcast = (event: StateEvent): void => {
  const message = JSON.stringify(event)
  for (const client of clients) {
    try {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message)
      }
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
  } else if (event.type === 'vessel_update') {
    broadcast({
      ...event,
      vessel: toApiVessel(event.vessel) as unknown as DbVessel,
    })
  } else {
    broadcast(event)
  }
})

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const sendJson = (res: ServerResponse, data: unknown, status = 200): void => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders })
  res.end(JSON.stringify(data))
}

const handleStationDetail = (res: ServerResponse, callsign: string): void => {
  const station = getStationByCallsign(callsign)
  if (!station) {
    sendJson(res, { error: 'Station not found' }, 404)
    return
  }
  const history = getStationHistory(station.id)
  sendJson(res, {
    station: toApiStation(station),
    history: history.map((h) => ({
      raw: h.raw_packet,
      latitude: h.latitude,
      longitude: h.longitude,
      path: h.path,
      receivedAt: new Date(h.received_at).toISOString(),
    })),
  })
}

const handleApiRequest = (req: IncomingMessage, res: ServerResponse, pathname: string): void => {
  const path = pathname.replace('/api', '')

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders)
    res.end()
    return
  }

  try {
    if (path === '/stations' && req.method === 'GET') {
      // Limit to 5000 most recent stations to prevent timeout on large datasets
      sendJson(res, { stations: getAllStations(5000).map(toApiStation) })
      return
    }

    const stationMatch = path.match(/^\/stations\/([^/]+)$/)
    if (stationMatch && req.method === 'GET') {
      handleStationDetail(res, decodeURIComponent(stationMatch[1] ?? ''))
      return
    }

    if (path === '/vessels' && req.method === 'GET') {
      sendJson(res, { vessels: getAllVessels().map(toApiVessel) })
      return
    }

    if (path === '/stats' && req.method === 'GET') {
      sendJson(res, { ...getStats(), kissConnected: stateManager.isKissConnected() })
      return
    }

    if (path === '/health' && req.method === 'GET') {
      const stats = getStats()
      const lastPacketAt = stateManager.getLastAprsPacketAt()
      const secondsSinceLastPacket =
        lastPacketAt === null ? null : Math.floor((Date.now() - lastPacketAt) / 1000)
      const sourceConnected =
        config.dataSource === 'aprs-is' ? aprsIsConnected : stateManager.isKissConnected()
      const receivingPackets = secondsSinceLastPacket !== null && secondsSinceLastPacket <= 180
      const healthy = sourceConnected && receivingPackets && stats.totalStations > 0

      sendJson(res, {
        status: healthy ? 'ok' : 'degraded',
        healthy,
        dataSource: config.dataSource,
        sourceConnected,
        kissConnected: stateManager.isKissConnected(),
        aprsIsConnected,
        receivingPackets,
        lastPacketAt: lastPacketAt === null ? null : new Date(lastPacketAt).toISOString(),
        secondsSinceLastPacket,
        totalStations: stats.totalStations,
        totalPackets: stats.totalPackets,
        connectedClients: clients.size,
      })
      return
    }

    if (path === '/version' && req.method === 'GET') {
      sendJson(res, {
        version: APP_VERSION,
        buildTime:
          typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString(),
      })
      return
    }

    sendJson(res, { error: 'Not found' }, 404)
  } catch (error) {
    console.error('[API] Error:', error)
    sendJson(res, { error: 'Internal server error' }, 500)
  }
}

// Start the server
export const startServer = async (): Promise<void> => {
  // Initialize database
  initializeDatabase()

  // Helper: process a parsed APRS packet from any source
  const handleAprsPacket = (parsed: ReturnType<typeof parseAprsPacket>) => {
    if (!parsed) return
    console.log(
      `[APRS] ${parsed.source} > ${parsed.destination}: ${parsed.comment || parsed.raw.slice(0, 50)}`
    )
    stateManager.emitAprsPacket({
      raw: parsed.raw,
      source: parsed.source,
      destination: parsed.destination,
      path: parsed.path.join(','),
      comment: parsed.comment,
      timestamp: new Date().toISOString(),
    })
    const existingStation = getStationByCallsign(parsed.source)
    const isNew = !existingStation
    const station = upsertStation(parsed)
    stateManager.emitStationUpdate(station, isNew)
  }

  if (config.dataSource === 'aprs-is') {
    // APRS-IS mode: receive packets directly from the internet network
    console.log(`[Server] Data source: APRS-IS (${config.aprsIs.server}:${config.aprsIs.port})`)
    const aprsIsClient = getAprsIsClient()

    aprsIsClient.on('connected', () => {
      aprsIsConnected = true
    })

    aprsIsClient.on('disconnected', () => {
      aprsIsConnected = false
    })

    aprsIsClient.on('packet', (line: string) => {
      try {
        const parsed = parseAprsIsPacket(line)
        handleAprsPacket(parsed)
      } catch (error) {
        console.error('[APRS-IS] Parse error:', error, line)
      }
    })

    aprsIsClient.on('error', (error: Error) => {
      console.error('[APRS-IS] Error:', error.message)
    })

    aprsIsClient.connect()
  } else {
    // KISS mode: receive packets from a local Direwolf/TNC via KISS TCP
    console.log(`[Server] Data source: KISS TNC (${config.kiss.host}:${config.kiss.port})`)
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
        handleAprsPacket(parsed)
      } catch (error) {
        console.error('[APRS] Parse error:', error, bytesToHex(packet))
      }
    })

    kissClient.on('error', (error: Error) => {
      console.error('[KISS] Error:', error.message)
    })

    // Connect to KISS TNC (don't await - allow server to start independently)
    kissClient.connect().catch((error: Error) => {
      console.error('[KISS] Initial connection failed:', error.message)
    })
  }

  // Initialize AIS client
  if (config.ais.source !== 'none') {
    console.log(`[Server] AIS source: ${config.ais.source}`)
    const aisClient = getAisClient({
      source: config.ais.source,
      kissHost: config.ais.kiss.host,
      kissPort: config.ais.kiss.port,
      kissReconnectIntervalMs: config.ais.kiss.reconnectIntervalMs,
      httpApiUrl: config.ais.http.apiUrl,
      httpUpdateIntervalMs: config.ais.http.updateIntervalMs,
    })

    aisClient.on('vessel', (vesselData) => {
      const vessel = upsertVessel(vesselData)
      stateManager.emitVesselUpdate(vessel, false)
    })

    aisClient.on('connected', () => {
      stateManager.emitAisConnected()
    })

    aisClient.on('disconnected', () => {
      stateManager.emitAisDisconnected()
    })

    aisClient.on('error', (error: Error) => {
      console.error('[AIS] Error:', error.message)
    })

    aisClient.connect()
  }

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

  // Create HTTP server
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)

    // API routes
    if (url.pathname.startsWith('/api')) {
      handleApiRequest(req, res, url.pathname)
      return
    }

    // GraphQL endpoint
    if (url.pathname === '/graphql') {
      handleGraphQL(req, res).catch((err) => {
        console.error('[GraphQL] Unhandled error:', err)
        res.writeHead(500)
        res.end('Internal server error')
      })
      return
    }

    res.writeHead(404)
    res.end('Not found')
  })

  // Create WebSocket servers using noServer mode
  // IMPORTANT: When multiple WebSocketServer instances share the same HTTP server,
  // you MUST use noServer mode and handle upgrades manually. Otherwise, the ws library
  // may send malformed frames (with RSV1 bit set incorrectly) causing "Invalid frame header"
  // errors in browsers. This was a significant debugging effort - do not change this pattern.
  // See: https://github.com/websockets/ws/issues/885
  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false, // Disable compression to avoid frame corruption
  })

  const spectrumWss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
  })

  // Handle WebSocket upgrades manually to route to correct server
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '/', `http://${request.headers.host}`).pathname

    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request)
      })
    } else if (pathname === '/ws/spectrum') {
      spectrumWss.handleUpgrade(request, socket, head, (ws) => {
        spectrumWss.emit('connection', ws, request)
      })
    } else {
      socket.destroy()
    }
  })

  wss.on('connection', (ws: WebSocket) => {
    const wsWithId = ws as WebSocketWithId
    wsWithId.id = randomUUID()
    clients.add(wsWithId)
    console.log(`[WS] Client connected (${clients.size} total)`)

    // Send initial state immediately as a single text frame
    // Limit to 5000 most recent stations to avoid oversized WebSocket init payloads
    try {
      const stations = getAllStations(5000).map(toApiStation)
      const vessels = getAllVessels().map(toApiVessel)
      const stats = getStats()

      // Get a capped amount of history to keep init payload fast and reliable
      const rawHistories = getAllStationHistories(6, 10, 500)
      const stationHistory: Record<
        string,
        Array<{
          raw: string
          source: string
          destination: string
          timestamp: string
          position: { latitude: number; longitude: number } | null
        }>
      > = {}

      for (const [callsign, packets] of Object.entries(rawHistories)) {
        stationHistory[callsign] = packets.map((p) => ({
          raw: p.raw_packet,
          source: callsign,
          destination: '',
          timestamp: new Date(p.received_at).toISOString(),
          position:
            p.latitude && p.longitude ? { latitude: p.latitude, longitude: p.longitude } : null,
        }))
      }

      const initMessage = JSON.stringify({
        type: 'init',
        stations,
        vessels,
        stats: {
          ...stats,
          kissConnected: stateManager.isKissConnected(),
          aisConnected: config.ais.source !== 'none',
        },
        stationHistory,
      })
      ws.send(initMessage)
    } catch (err) {
      console.error('[WS] Failed to send init:', err)
    }

    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString())
        console.log('[WS] Received:', data)
      } catch {
        // Ignore invalid messages
      }
    })

    ws.on('close', (code, reason) => {
      clients.delete(wsWithId)
      console.log(
        `[WS] Client disconnected - code: ${code}, reason: "${reason?.toString() || ''}" (${clients.size} remaining)`
      )
    })

    ws.on('error', (error) => {
      console.error('[WS] Client error:', error)
      clients.delete(wsWithId)
    })
  })

  // Spectrum analyzer state
  let spectrumAnalyzer: SpectrumAnalyzer | null = null
  const spectrumClients = new Set<WebSocket>()

  spectrumWss.on('connection', (ws: WebSocket) => {
    spectrumClients.add(ws)
    console.log(`[Spectrum WS] Client connected (${spectrumClients.size} total)`)

    // Start spectrum analyzer if not already running
    if (!spectrumAnalyzer && spectrumClients.size > 0) {
      const freq = Number.parseInt(process.env.RTL_FREQ || '144800000', 10)
      spectrumAnalyzer = new SpectrumAnalyzer(freq)

      spectrumAnalyzer.on('data', (data) => {
        const message = JSON.stringify({ type: 'spectrum', data })
        for (const client of spectrumClients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message)
          }
        }
      })

      spectrumAnalyzer.start()
    }

    ws.on('close', () => {
      spectrumClients.delete(ws)
      console.log(`[Spectrum WS] Client disconnected (${spectrumClients.size} remaining)`)

      // Stop analyzer if no clients
      if (spectrumClients.size === 0 && spectrumAnalyzer) {
        spectrumAnalyzer.stop()
        spectrumAnalyzer = null
      }
    })

    ws.on('error', (error) => {
      console.error('[Spectrum WS] Client error:', error)
      spectrumClients.delete(ws)
    })
  })

  server.listen(config.web.port, config.web.host, () => {
    console.log(`[Server] Listening on ${config.web.host}:${config.web.port}`)
  })

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[Server] Shutting down...')
    closeKissClient()
    closeAprsIsClient()
    closeAisClient()
    closeDatabase()
    server.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

// Run if executed directly
const isMain = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')
if (isMain) {
  startServer().catch((error) => {
    console.error('[Server] Fatal error:', error)
    process.exit(1)
  })
}
