import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_CONFIG } from '../constants'
import { loadStations } from '../services'
import type { KmlLoadResult, Station } from '../types'
import { logger } from '../utils'

interface UseStationsResult {
  stations: Station[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  refresh: () => Promise<void>
}

export const useStations = (
  url: string = DEFAULT_CONFIG.kmlUrl,
  refreshInterval: number = DEFAULT_CONFIG.refreshIntervalMs
): UseStationsResult => {
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const result: KmlLoadResult = await loadStations(url)

    setStations(result.stations)
    setLastUpdated(result.loadedAt)
    setError(result.error ?? null)
    setLoading(false)

    result.error
      ? logger.error({ error: result.error }, 'Station refresh failed')
      : logger.info({ count: result.stations.length }, 'Stations refreshed')
  }, [url])

  useEffect(() => {
    refresh()

    const interval = setInterval(refresh, refreshInterval)
    return () => clearInterval(interval)
  }, [refresh, refreshInterval])

  return { stations, loading, error, lastUpdated, refresh }
}
