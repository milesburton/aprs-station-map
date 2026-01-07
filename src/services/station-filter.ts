import type { FilterState, SortDirection, SortField, Station } from '../types'

const matchesSearch = (station: Station, search: string): boolean => {
  const term = search.toLowerCase().trim()
  return (
    term === '' ||
    station.callsign.toLowerCase().includes(term) ||
    station.comment.toLowerCase().includes(term)
  )
}

const matchesSymbol = (station: Station, symbolFilter: string | null): boolean =>
  symbolFilter === null || station.symbol === symbolFilter

const matchesDistance = (station: Station, maxDistance: number): boolean =>
  station.distance <= maxDistance

const compare = <T>(a: T, b: T, direction: SortDirection): number => {
  const modifier = direction === 'asc' ? 1 : -1
  return a < b ? -1 * modifier : a > b ? 1 * modifier : 0
}

const sortStations = (
  stations: Station[],
  sortBy: SortField,
  direction: SortDirection
): Station[] => {
  const sortFns: Record<SortField, (a: Station, b: Station) => number> = {
    callsign: (a, b) => compare(a.callsign.toLowerCase(), b.callsign.toLowerCase(), direction),
    distance: (a, b) => compare(a.distance, b.distance, direction),
    lastHeard: (a, b) => compare(a.lastHeard.getTime(), b.lastHeard.getTime(), direction),
  }

  return [...stations].sort(sortFns[sortBy])
}

export const filterStations = (stations: Station[], filter: FilterState): Station[] => {
  const filtered = stations.filter(
    (station) =>
      matchesSearch(station, filter.search) &&
      matchesSymbol(station, filter.symbolFilter) &&
      matchesDistance(station, filter.maxDistance)
  )

  return sortStations(filtered, filter.sortBy, filter.sortDirection)
}

export const getUniqueSymbols = (stations: Station[]): string[] =>
  [...new Set(stations.map((s) => s.symbol))].sort()

export const getStationStats = (
  stations: Station[]
): { total: number; avgDistance: number; furthest: Station | null } => {
  const total = stations.length
  const avgDistance = total > 0 ? stations.reduce((sum, s) => sum + s.distance, 0) / total : 0
  const furthest = stations.reduce<Station | null>(
    (max, s) => (max === null || s.distance > max.distance ? s : max),
    null
  )
  return { total, avgDistance, furthest }
}
