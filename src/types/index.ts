export interface Coordinates {
  latitude: number
  longitude: number
}

export interface Station {
  callsign: string
  coordinates: Coordinates
  symbol: string
  comment: string
  lastHeard: Date
  distance: number
  bearing: number
  frequency?: number
  altitude?: number
  course?: number
  speed?: number
  via?: string[]
}

export interface StationFeature {
  type: 'Feature'
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
  properties: {
    name: string
    description?: string
  }
}

export interface FilterState {
  search: string
  maxDistance: number
  symbolFilter: string | null
  hideNoPosition: boolean
  sortBy: SortField
  sortDirection: SortDirection
}

export type SortField = 'callsign' | 'distance' | 'lastHeard'
export type SortDirection = 'asc' | 'desc'

export interface MapState {
  centre: Coordinates
  zoom: number
  selectedStation: string | null
}

export interface AppConfig {
  kmlUrl: string
  refreshIntervalMs: number
  stationLocation: Coordinates
  maxDistanceKm: number
  defaultZoom: number
}

export interface KmlLoadResult {
  stations: Station[]
  loadedAt: Date
  error?: string
}
