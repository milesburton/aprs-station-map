import { useCallback, useMemo, useState } from 'react'
import { DEFAULT_FILTER_STATE } from '../constants'
import { filterStations } from '../services'
import type { FilterState, SortDirection, SortField, Station } from '../types'

interface UseFiltersResult {
  filter: FilterState
  filteredStations: Station[]
  setSearch: (search: string) => void
  setMaxDistance: (distance: number) => void
  setSymbolFilter: (symbol: string | null) => void
  setSort: (field: SortField, direction: SortDirection) => void
  resetFilters: () => void
}

export const useFilters = (stations: Station[]): UseFiltersResult => {
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER_STATE)

  const filteredStations = useMemo(() => filterStations(stations, filter), [stations, filter])

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

  const resetFilters = useCallback(() => setFilter(DEFAULT_FILTER_STATE), [])

  return {
    filter,
    filteredStations,
    setSearch,
    setMaxDistance,
    setSymbolFilter,
    setSort,
    resetFilters,
  }
}
