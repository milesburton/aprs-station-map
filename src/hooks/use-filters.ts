import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_FILTER_STATE } from '../constants'
import { filterStations } from '../services'
import type { FilterState, SortDirection, SortField, Station } from '../types'

const FILTER_STORAGE_KEY = 'aprs-filter-state'

const loadFilterState = (): FilterState => {
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<FilterState>
      return { ...DEFAULT_FILTER_STATE, ...parsed }
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_FILTER_STATE
}

interface UseFiltersResult {
  filter: FilterState
  filteredStations: Station[]
  setSearch: (search: string) => void
  setMaxDistance: (distance: number) => void
  setSymbolFilter: (symbol: string | null) => void
  setSort: (field: SortField, direction: SortDirection) => void
  setTrailMaxAge: (hours: number) => void
  setStationMaxAge: (hours: number) => void
  setRfOnly: (rfOnly: boolean) => void
  resetFilters: () => void
}

export const useFilters = (stations: Station[]): UseFiltersResult => {
  const [filter, setFilter] = useState<FilterState>(loadFilterState)

  const filteredStations = useMemo(() => filterStations(stations, filter), [stations, filter])

  // Persist filter state to localStorage (exclude search to avoid stale queries)
  useEffect(() => {
    const { search: _, ...filterToSave } = filter
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filterToSave))
  }, [filter])

  const setSearch = useCallback((search: string) => setFilter((prev) => ({ ...prev, search })), [])

  const setMaxDistance = useCallback(
    (maxDistance: number) => setFilter((prev) => ({ ...prev, maxDistance })),
    []
  )

  const setSymbolFilter = useCallback(
    (symbolFilter: string | null) => setFilter((prev) => ({ ...prev, symbolFilter })),
    []
  )

  const setSort = useCallback(
    (sortBy: SortField, sortDirection: SortDirection) =>
      setFilter((prev) => ({ ...prev, sortBy, sortDirection })),
    []
  )

  const setTrailMaxAge = useCallback(
    (trailMaxAgeHours: number) => setFilter((prev) => ({ ...prev, trailMaxAgeHours })),
    []
  )

  const setStationMaxAge = useCallback(
    (stationMaxAgeHours: number) => setFilter((prev) => ({ ...prev, stationMaxAgeHours })),
    []
  )

  const setRfOnly = useCallback((rfOnly: boolean) => setFilter((prev) => ({ ...prev, rfOnly })), [])

  const resetFilters = useCallback(() => setFilter(DEFAULT_FILTER_STATE), [])

  return {
    filter,
    filteredStations,
    setSearch,
    setMaxDistance,
    setSymbolFilter,
    setSort,
    setTrailMaxAge,
    setStationMaxAge,
    setRfOnly,
    resetFilters,
  }
}
