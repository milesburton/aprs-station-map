export interface Coordinates {
  latitude: number
  longitude: number
}

export interface Station {
  callsign: string
  coordinates: Coordinates | null
  symbol: string
  symbolTable: string
  comment: string
  lastHeard: Date | string
  distance: number | null
  bearing: number | null
  frequency?: number
  altitude?: number
  course?: number
  speed?: number
  via?: string[]
  packetCount: number
  signalStrength?: number
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
  trailMaxAgeHours: number
  stationMaxAgeHours: number
  rfOnly: boolean
  directOnly: boolean
}

export type SortField = 'callsign' | 'distance' | 'lastHeard'
export type SortDirection = 'asc' | 'desc'

export interface MapState {
  centre: Coordinates
  zoom: number
  selectedStation: string | null
  followedStation: string | null
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
  totalVessels?: number
  vesselsWithPosition?: number
  aisConnected?: boolean
}

export interface HealthStatus {
  status: 'ok' | 'degraded'
  healthy: boolean
  dataSource: 'kiss' | 'aprs-is'
  sourceConnected: boolean
  kissConnected: boolean
  aprsIsConnected: boolean
  receivingPackets: boolean
  lastPacketAt: string | null
  secondsSinceLastPacket: number | null
  totalStations: number
  totalPackets: number
  connectedClients: number
}

export interface AprsPacket {
  raw: string
  source: string
  destination: string
  path?: string
  comment?: string
  timestamp: string
  type?: 'position' | 'status' | 'message' | 'telemetry' | 'weather' | 'unknown'
  symbol?: string
  symbolTable?: string
  position?: {
    latitude: number
    longitude: number
    altitude?: number
    course?: number
    speed?: number
  }
}

export interface Vessel {
  mmsi: string
  callsign: string
  shipName: string
  coordinates: Coordinates | null
  course?: number
  speed?: number
  heading?: number
  shipType?: string
  lastHeard: Date | string
  distance: number | null
  bearing: number | null
  packetCount: number
}

export interface WebSocketMessage {
  type:
    | 'init'
    | 'station_update'
    | 'stats_update'
    | 'kiss_connected'
    | 'kiss_disconnected'
    | 'aprs_packet'
    | 'vessel_update'
    | 'ais_connected'
    | 'ais_disconnected'
  stations?: Station[]
  station?: Station
  vessels?: Vessel[]
  vessel?: Vessel
  stats?: Stats
  isNew?: boolean
  packet?: AprsPacket
  stationHistory?: Record<string, AprsPacket[]>
}
