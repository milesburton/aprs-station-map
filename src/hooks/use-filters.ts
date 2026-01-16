import { useCallback, useMemo } from 'react'
import { filterStations } from '../services'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  resetFilters as resetFiltersAction,
  setDirectOnly as setDirectOnlyAction,
  setMaxDistance as setMaxDistanceAction,
  setRfOnly as setRfOnlyAction,
  setSearch as setSearchAction,
  setSort as setSortAction,
  setStationMaxAge as setStationMaxAgeAction,
  setSymbolFilter as setSymbolFilterAction,
  setTrailMaxAge as setTrailMaxAgeAction,
} from '../store/slices/filterSlice'
import type { FilterState, SortDirection, SortField, Station } from '../types'

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
  setDirectOnly: (directOnly: boolean) => void
  resetFilters: () => void
}

export const useFilters = (stations: Station[]): UseFiltersResult => {
  const dispatch = useAppDispatch()
  const filter = useAppSelector((state) => state.filters)

  const filteredStations = useMemo(() => filterStations(stations, filter), [stations, filter])

  const setSearch = useCallback((search: string) => dispatch(setSearchAction(search)), [dispatch])

  const setMaxDistance = useCallback(
    (maxDistance: number) => dispatch(setMaxDistanceAction(maxDistance)),
    [dispatch]
  )

  const setSymbolFilter = useCallback(
    (symbolFilter: string | null) => dispatch(setSymbolFilterAction(symbolFilter)),
    [dispatch]
  )

  const setSort = useCallback(
    (field: SortField, direction: SortDirection) => dispatch(setSortAction({ field, direction })),
    [dispatch]
  )

  const setTrailMaxAge = useCallback(
    (hours: number) => dispatch(setTrailMaxAgeAction(hours)),
    [dispatch]
  )

  const setStationMaxAge = useCallback(
    (hours: number) => dispatch(setStationMaxAgeAction(hours)),
    [dispatch]
  )

  const setRfOnly = useCallback((rfOnly: boolean) => dispatch(setRfOnlyAction(rfOnly)), [dispatch])

  const setDirectOnly = useCallback(
    (directOnly: boolean) => dispatch(setDirectOnlyAction(directOnly)),
    [dispatch]
  )

  const resetFilters = useCallback(() => dispatch(resetFiltersAction()), [dispatch])

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
    setDirectOnly,
    resetFilters,
  }
}
