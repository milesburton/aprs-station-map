import { useEffect, useRef, useState } from 'react'
import { DEFAULT_CONFIG } from '../constants'
import type { AprsPacket, HealthStatus, Station, Stats, WebSocketMessage } from '../types'
import { logger } from '../utils'

interface UseStationsResult {
  stations: Station[]
  stats: Stats | null
  health: HealthStatus | null
  loading: boolean
  error: string | null
  connected: boolean
  kissConnected: boolean
  lastUpdated: Date | null
  packets: AprsPacket[]
  stationHistory: Map<string, AprsPacket[]>
  refresh: () => Promise<void>
}

const MAX_PACKETS = 100
const MAX_STATION_HISTORY = 50

const deduplicateStations = (stations: Station[]): Station[] => {
  const map = new Map<string, Station>()
  for (const station of stations) {
    const existing = map.get(station.callsign)
    if (!existing) {
      map.set(station.callsign, station)
    } else {
      const existingTime =
        typeof existing.lastHeard === 'string'
          ? new Date(existing.lastHeard).getTime()
          : existing.lastHeard.getTime()
      const newTime =
        typeof station.lastHeard === 'string'
          ? new Date(station.lastHeard).getTime()
          : station.lastHeard.getTime()
      if (newTime > existingTime) {
        map.set(station.callsign, station)
      }
    }
  }
  return Array.from(map.values())
}

export const useStations = (wsUrl: string = DEFAULT_CONFIG.wsUrl): UseStationsResult => {
  const [stations, setStations] = useState<Station[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [kissConnected, setKissConnected] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [packets, setPackets] = useState<AprsPacket[]>([])
  const [stationHistory, setStationHistory] = useState<Map<string, AprsPacket[]>>(new Map())

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const healthTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  // High-frequency WS events (station_update, aprs_packet) accumulate in these
  // buffers and flush once per animation frame. Without this, each packet
  // triggers a React reconcile, which jams the UI under live APRS-IS load.
  const pendingStationsRef = useRef<Map<string, Station>>(new Map())
  const pendingPacketsRef = useRef<AprsPacket[]>([])
  const flushScheduledRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true

    const fetchHealth = async () => {
      try {
        const response = await fetch(`${DEFAULT_CONFIG.apiUrl}/health`)
        if (!response.ok && response.status !== 503) return
        const data = (await response.json()) as HealthStatus
        if (mountedRef.current) {
          setHealth(data)
        }
      } catch {
        // best-effort only — don't surface health errors to the user
      }
    }

    const poll = async () => {
      await fetchHealth()
      if (mountedRef.current) {
        healthTimeout.current = setTimeout(poll, 15000)
      }
    }

    poll()

    return () => {
      mountedRef.current = false
      if (healthTimeout.current) {
        clearTimeout(healthTimeout.current)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true

    const connect = () => {
      if (!mountedRef.current) return
      if (
        wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING
      ) {
        return
      }

      console.log('[WS] Connecting to', wsUrl)
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close()
          return
        }
        console.log('[WS] Connected')
        setConnected(true)
        setError(null)
      }

      ws.onclose = (event) => {
        console.log('[WS] Closed:', event.code, event.wasClean)
        wsRef.current = null
        if (mountedRef.current) {
          setConnected(false)
          if (!event.wasClean) {
            reconnectTimeout.current = setTimeout(connect, 2000)
          }
        }
      }

      ws.onerror = () => {
        if (mountedRef.current) {
          setError('Connection error')
        }
      }

      const flush = (): void => {
        flushScheduledRef.current = false
        if (!mountedRef.current) return

        if (pendingStationsRef.current.size > 0) {
          const updates = pendingStationsRef.current
          pendingStationsRef.current = new Map()
          setStations((prev) => {
            const known = new Set(prev.map((s) => s.callsign))
            const updated = prev.map((s) => updates.get(s.callsign) ?? s)
            const newStations: Station[] = []
            for (const [callsign, station] of updates) {
              if (!known.has(callsign)) newStations.push(station)
            }
            return newStations.length > 0 ? [...newStations, ...updated] : updated
          })
          setLastUpdated(new Date())
        }

        if (pendingPacketsRef.current.length > 0) {
          const incoming = pendingPacketsRef.current
          pendingPacketsRef.current = []
          setPackets((prev) => prev.concat(incoming).slice(-MAX_PACKETS))
          setStationHistory((prev) => {
            const next = new Map(prev)
            for (const packet of incoming) {
              const callsign = packet.source
              const existing = next.get(callsign) ?? []
              const last = existing[existing.length - 1]
              if (!last || last.timestamp !== packet.timestamp) {
                next.set(callsign, [...existing, packet].slice(-MAX_STATION_HISTORY))
              }
            }
            return next
          })
        }
      }

      const scheduleFlush = (): void => {
        if (flushScheduledRef.current) return
        flushScheduledRef.current = true
        requestAnimationFrame(flush)
      }

      ws.onmessage = (event) => {
        if (!mountedRef.current) return
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          switch (message.type) {
            case 'init':
              if (message.stations) {
                setStations(deduplicateStations(message.stations))
                setLoading(false)
                setLastUpdated(new Date())
                logger.info({ count: message.stations.length }, 'Initial stations received')
              }
              if (message.stats) {
                setStats(message.stats)
                setKissConnected(message.stats.kissConnected)
              }
              if (message.stationHistory) {
                const historyMap = new Map<string, AprsPacket[]>()
                for (const [callsign, packets] of Object.entries(
                  message.stationHistory as Record<string, AprsPacket[]>
                )) {
                  historyMap.set(callsign, packets)
                }
                setStationHistory(historyMap)
                logger.info(
                  { stationsWithHistory: historyMap.size },
                  'Station history loaded for trails'
                )
              }
              break
            case 'station_update':
              if (message.station) {
                pendingStationsRef.current.set(message.station.callsign, message.station)
                scheduleFlush()
              }
              break
            case 'stats_update':
              if (message.stats) {
                setStats(message.stats)
              }
              break
            case 'kiss_connected':
              logger.info('KISS TNC connected')
              setKissConnected(true)
              break
            case 'kiss_disconnected':
              logger.warn('KISS TNC disconnected')
              setKissConnected(false)
              break
            case 'aprs_packet':
              if (message.packet) {
                pendingPacketsRef.current.push(message.packet as AprsPacket)
                scheduleFlush()
              }
              break
          }
        } catch {
          // malformed WebSocket message — discard
        }
      }
    }

    connect()

    return () => {
      mountedRef.current = false
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current)
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'unmounting')
      }
    }
  }, [wsUrl])

  const refresh = async () => {
    try {
      const response = await fetch(`${DEFAULT_CONFIG.apiUrl}/stations`)
      if (!response.ok) throw new Error('Failed to fetch stations')
      const data = await response.json()
      if (data.stations) {
        setStations(deduplicateStations(data.stations))
        setLastUpdated(new Date())
      }
    } catch {
      setError('Failed to refresh data')
    }
  }

  return {
    stations,
    stats,
    health,
    loading,
    error,
    connected,
    kissConnected,
    lastUpdated,
    packets,
    stationHistory,
    refresh,
  }
}
