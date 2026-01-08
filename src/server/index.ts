import { randomUUID } from 'node:crypto'
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
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

interface WebSocketWithId extends WebSocket {
  id: string
}

// Track connected WebSocket clients
const clients = new Set<WebSocketWithId>()

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

// API route handlers
const handleApiRequest = (req: IncomingMessage, res: ServerResponse, pathname: string): void => {
  const path = pathname.replace('/api', '')

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders)
    res.end()
    return
  }

  try {
    // GET /api/stations
    if (path === '/stations' && req.method === 'GET') {
      const stations = getAllStations().map(toApiStation)
      sendJson(res, { stations })
      return
    }

    // GET /api/stations/:callsign
    const stationMatch = path.match(/^\/stations\/([^/]+)$/)
    if (stationMatch && req.method === 'GET') {
      const callsign = decodeURIComponent(stationMatch[1] ?? '')
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
      return
    }

    // GET /api/stats
    if (path === '/stats' && req.method === 'GET') {
      const stats = getStats()
      sendJson(res, {
        ...stats,
        kissConnected: stateManager.isKissConnected(),
      })
      return
    }

    // GET /api/health
    if (path === '/health' && req.method === 'GET') {
      sendJson(res, {
        status: 'ok',
        kissConnected: stateManager.isKissConnected(),
        connectedClients: clients.size,
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

  // Connect to KISS TNC (don't await - allow server to start independently)
  kissClient.connect().catch((error) => {
    console.error('[KISS] Initial connection failed:', error.message)
  })

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

    res.writeHead(404)
    res.end('Not found')
  })

  // Create WebSocket server
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws: WebSocket) => {
    const wsWithId = ws as WebSocketWithId
    wsWithId.id = randomUUID()
    clients.add(wsWithId)
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

    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString())
        console.log('[WS] Received:', data)
      } catch {
        // Ignore invalid messages
      }
    })

    ws.on('close', () => {
      clients.delete(wsWithId)
      console.log(`[WS] Client disconnected (${clients.size} remaining)`)
    })

    ws.on('error', (error) => {
      console.error('[WS] Client error:', error)
      clients.delete(wsWithId)
    })
  })

  server.listen(config.web.port, config.web.host, () => {
    console.log(`[Server] Listening on ${config.web.host}:${config.web.port}`)
  })

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[Server] Shutting down...')
    closeKissClient()
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
