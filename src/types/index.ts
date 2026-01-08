export interface Coordinates {
  latitude: number
  longitude: number
}

export interface Station {
  callsign: string
  coordinates: Coordinates | null
  symbol: string
  comment: string
  lastHeard: Date | string
  distance: number | null
  bearing: number | null
  frequency?: number
  altitude?: number
  course?: number
  speed?: number
  via?: string[]
  packetCount?: number
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
  apiUrl: string
  wsUrl: string
  stationLocation: Coordinates
  maxDistanceKm: number
  defaultZoom: number
}

export interface Stats {
  totalStations: number
  stationsWithPosition: number
  totalPackets: number
  kissConnected: boolean
}

export interface AprsPacket {
  raw: string
  source: string
  destination: string
  path?: string
  comment?: string
  timestamp: string
}

export interface WebSocketMessage {
  type:
    | 'init'
    | 'station_update'
    | 'stats_update'
    | 'kiss_connected'
    | 'kiss_disconnected'
    | 'aprs_packet'
  stations?: Station[]
  station?: Station
  stats?: Stats
  isNew?: boolean
  packet?: AprsPacket
}
