import { useEffect, useRef, useState } from 'react'
import { DEFAULT_CONFIG } from '../constants'
import type { AprsPacket, Station, Stats, WebSocketMessage } from '../types'
import { logger } from '../utils'

interface UseStationsResult {
  stations: Station[]
  stats: Stats | null
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

// Deduplicate stations by callsign, keeping the most recent
const deduplicateStations = (stations: Station[]): Station[] => {
  const map = new Map<string, Station>()
  for (const station of stations) {
    const existing = map.get(station.callsign)
    if (!existing) {
      map.set(station.callsign, station)
    } else {
      // Keep the one with more recent lastHeard
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [kissConnected, setKissConnected] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [packets, setPackets] = useState<AprsPacket[]>([])
  const [stationHistory, setStationHistory] = useState<Map<string, AprsPacket[]>>(new Map())

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  // Single effect that manages the entire WebSocket lifecycle
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
              break
            case 'station_update':
              if (message.station) {
                const updatedStation = message.station
                setStations((prev) => {
                  const index = prev.findIndex((s) => s.callsign === updatedStation.callsign)
                  if (index >= 0) {
                    const updated = [...prev]
                    updated[index] = updatedStation
                    return updated
                  }
                  return [updatedStation, ...prev]
                })
                setLastUpdated(new Date())
              }
              break
            case 'stats_update':
              if (message.stats) {
                setStats(message.stats)
                // Note: kissConnected is NOT updated here - it's only set from
                // init, kiss_connected, and kiss_disconnected events
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
                const packet = message.packet as AprsPacket
                setPackets((prev) => {
                  const updated = [...prev, packet]
                  return updated.slice(-MAX_PACKETS)
                })
                setStationHistory((prev) => {
                  const newMap = new Map(prev)
                  const callsign = packet.source
                  const existing = newMap.get(callsign) ?? []
                  const updated = [...existing, packet].slice(-MAX_STATION_HISTORY)
                  newMap.set(callsign, updated)
                  return newMap
                })
              }
              break
          }
        } catch {
          // Ignore parse errors
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
  }, [wsUrl]) // Only depends on wsUrl - stable dependency

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
