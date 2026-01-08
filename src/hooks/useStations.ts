import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_CONFIG } from '../constants'
import type { Station, Stats, WebSocketMessage } from '../types'
import { logger } from '../utils'

interface UseStationsResult {
  stations: Station[]
  stats: Stats | null
  loading: boolean
  error: string | null
  connected: boolean
  lastUpdated: Date | null
  refresh: () => Promise<void>
}

const MAX_RECONNECT_ATTEMPTS = 20
const INITIAL_RECONNECT_DELAY = 1000

export const useStations = (wsUrl: string = DEFAULT_CONFIG.wsUrl): UseStationsResult => {
  const [stations, setStations] = useState<Station[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttempts = useRef(0)
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'init':
        if (message.stations) {
          setStations(message.stations)
          setLoading(false)
          setLastUpdated(new Date())
          logger.info({ count: message.stations.length }, 'Initial stations received')
        }
        if (message.stats) {
          setStats(message.stats)
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
        }
        break
      case 'kiss_connected':
        logger.info('KISS TNC connected')
        break
      case 'kiss_disconnected':
        logger.warn('KISS TNC disconnected')
        break
    }
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        logger.info('WebSocket connected')
        setConnected(true)
        setError(null)
        reconnectAttempts.current = 0
      }

      ws.onclose = () => {
        logger.info('WebSocket disconnected')
        setConnected(false)
        wsRef.current = null

        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = INITIAL_RECONNECT_DELAY * 2 ** reconnectAttempts.current
          logger.info({ attempt: reconnectAttempts.current + 1, delay }, 'Scheduling reconnect')
          reconnectTimeout.current = setTimeout(
            () => {
              reconnectAttempts.current++
              connect()
            },
            Math.min(delay, 30000)
          )
        } else {
          setError('Connection lost. Please refresh the page.')
        }
      }

      ws.onerror = (event) => {
        logger.error({ event }, 'WebSocket error')
        setError('Connection error')
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          handleWebSocketMessage(message)
        } catch (err) {
          logger.error({ err }, 'Failed to parse WebSocket message')
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to create WebSocket')
      setError('Failed to connect')
    }
  }, [wsUrl, handleWebSocketMessage])

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${DEFAULT_CONFIG.apiUrl}/stations`)
      if (!response.ok) throw new Error('Failed to fetch stations')
      const data = await response.json()
      setStations(data)
      setLastUpdated(new Date())
    } catch (err) {
      logger.error({ err }, 'Failed to refresh stations')
      setError('Failed to refresh data')
    }
  }, [])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])

  return { stations, stats, loading, error, connected, lastUpdated, refresh }
}
