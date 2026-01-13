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
  station.distance == null || station.distance <= maxDistance

const matchesStationAge = (station: Station, maxAgeHours: number): boolean => {
  if (maxAgeHours === 0) return true // 0 means "all time"
  const lastHeard =
    typeof station.lastHeard === 'string' ? new Date(station.lastHeard) : station.lastHeard
  const ageMs = Date.now() - lastHeard.getTime()
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000
  return ageMs <= maxAgeMs
}

// Internet gateway markers in APRS paths
const INTERNET_MARKERS = ['TCPIP', 'TCPIP*', 'qAC', 'qAO', 'qAR', 'qAS', 'qAX', 'qAI', 'qAZ']

const isRfOnly = (station: Station): boolean => {
  if (!station.via || station.via.length === 0) return true // Direct
  // Check if any path element contains internet markers
  return !station.via.some((hop) =>
    INTERNET_MARKERS.some((marker) => hop.toUpperCase().includes(marker.toUpperCase()))
  )
}

const compare = <T>(a: T, b: T, direction: SortDirection): number => {
  const modifier = direction === 'asc' ? 1 : -1
  return a < b ? -1 * modifier : a > b ? 1 * modifier : 0
}

const toDate = (d: Date | string): Date => (typeof d === 'string' ? new Date(d) : d)

const sortStations = (
  stations: Station[],
  sortBy: SortField,
  direction: SortDirection
): Station[] => {
  const sortFns: Record<SortField, (a: Station, b: Station) => number> = {
    callsign: (a, b) => compare(a.callsign.toLowerCase(), b.callsign.toLowerCase(), direction),
    distance: (a, b) =>
      compare(
        a.distance ?? Number.POSITIVE_INFINITY,
        b.distance ?? Number.POSITIVE_INFINITY,
        direction
      ),
    lastHeard: (a, b) =>
      compare(toDate(a.lastHeard).getTime(), toDate(b.lastHeard).getTime(), direction),
  }

  return [...stations].sort(sortFns[sortBy])
}

export const filterStations = (stations: Station[], filter: FilterState): Station[] => {
  const filtered = stations.filter(
    (station) =>
      matchesSearch(station, filter.search) &&
      matchesSymbol(station, filter.symbolFilter) &&
      matchesDistance(station, filter.maxDistance) &&
      matchesStationAge(station, filter.stationMaxAgeHours) &&
      (!filter.rfOnly || isRfOnly(station))
  )

  return sortStations(filtered, filter.sortBy, filter.sortDirection)
}

export const getUniqueSymbols = (stations: Station[]): string[] =>
  [...new Set(stations.map((s) => s.symbol))].sort()

export const getStationStats = (
  stations: Station[]
): { total: number; avgDistance: number; furthest: Station | null } => {
  const withDistance = stations.filter((s) => s.distance != null)
  const total = stations.length
  const avgDistance =
    withDistance.length > 0
      ? withDistance.reduce((sum, s) => sum + (s.distance ?? 0), 0) / withDistance.length
      : 0
  const furthest = withDistance.reduce<Station | null>(
    (max, s) => (max === null || (s.distance ?? 0) > (max.distance ?? 0) ? s : max),
    null
  )
  return { total, avgDistance, furthest }
}
