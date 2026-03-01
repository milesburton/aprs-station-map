import type { AppConfig, Coordinates, FilterState } from './types'

export const DEFAULT_LOCATION: Coordinates = {
  latitude: 51.4416,
  longitude: 0.15,
}

export const DEFAULT_CONFIG: AppConfig = {
  apiUrl: '/api',
  wsUrl: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`,
  stationLocation: DEFAULT_LOCATION,
  maxDistanceKm: 600,
  defaultZoom: 9,
}

export const DEFAULT_FILTER_STATE: FilterState = {
  search: '',
  maxDistance: DEFAULT_CONFIG.maxDistanceKm,
  symbolFilter: null,
  hideNoPosition: false,
  sortBy: 'lastHeard',
  sortDirection: 'desc',
  trailMaxAgeHours: 24,
  stationMaxAgeHours: 24,
  rfOnly: true,
  directOnly: false,
}

export const EARTH_RADIUS_KM = 6371

export interface AprsSymbolInfo {
  name: string
  emoji: string
  color: string
  category:
    | 'vehicle'
    | 'aircraft'
    | 'maritime'
    | 'infrastructure'
    | 'weather'
    | 'emergency'
    | 'other'
}

// APRS Symbol Table (Primary table '/' and Alternate table '\')
// Reference: http://www.aprs.org/symbols.html
export const APRS_SYMBOLS: Record<string, AprsSymbolInfo> = {
  // Vehicles (Mobile)
  '>': { name: 'Car', emoji: '🚗', color: '#4CAF50', category: 'vehicle' },
  k: { name: 'Truck', emoji: '🚚', color: '#FF9800', category: 'vehicle' },
  b: { name: 'Bicycle', emoji: '🚴', color: '#2196F3', category: 'vehicle' },
  R: { name: 'RV', emoji: '🚐', color: '#9C27B0', category: 'vehicle' },
  j: { name: 'Jeep', emoji: '🚙', color: '#795548', category: 'vehicle' },
  v: { name: 'Van', emoji: '🚐', color: '#607D8B', category: 'vehicle' },
  u: { name: 'Bus', emoji: '🚌', color: '#FFC107', category: 'vehicle' },
  U: { name: 'School Bus', emoji: '🚸', color: '#FF5722', category: 'vehicle' },
  '<': { name: 'Motorcycle', emoji: '🏍️', color: '#E91E63', category: 'vehicle' },

  // Emergency
  a: { name: 'Ambulance', emoji: '🚑', color: '#F44336', category: 'emergency' },
  f: { name: 'Fire Truck', emoji: '🚒', color: '#D32F2F', category: 'emergency' },
  p: { name: 'Police', emoji: '🚓', color: '#1976D2', category: 'emergency' },
  c: { name: 'Command Post', emoji: '🏢', color: '#FF6F00', category: 'emergency' },

  // Aircraft
  "'": { name: 'Aircraft', emoji: '✈️', color: '#00BCD4', category: 'aircraft' },
  '^': { name: 'Large Aircraft', emoji: '✈️', color: '#0097A7', category: 'aircraft' },
  X: { name: 'Helicopter', emoji: '🚁', color: '#00ACC1', category: 'aircraft' },
  O: { name: 'Balloon', emoji: '🎈', color: '#E91E63', category: 'aircraft' },

  // Maritime
  Y: { name: 'Yacht', emoji: '⛵', color: '#0288D1', category: 'maritime' },
  s: { name: 'Boat', emoji: '🚤', color: '#039BE5', category: 'maritime' },
  S: { name: 'Ship', emoji: '🚢', color: '#01579B', category: 'maritime' },

  // Infrastructure
  '-': { name: 'House', emoji: '🏠', color: '#8BC34A', category: 'infrastructure' },
  '#': { name: 'Digipeater', emoji: '📡', color: '#9C27B0', category: 'infrastructure' },
  '&': { name: 'Gateway', emoji: '🌐', color: '#673AB7', category: 'infrastructure' },
  r: { name: 'Repeater', emoji: '📻', color: '#3F51B5', category: 'infrastructure' },
  I: { name: 'TCP/IP', emoji: '💻', color: '#5E35B1', category: 'infrastructure' },
  n: { name: 'Node', emoji: '🔷', color: '#7E57C2', category: 'infrastructure' },
  '?': { name: 'Server', emoji: '🖥️', color: '#512DA8', category: 'infrastructure' },

  // Weather
  _: { name: 'Weather Station', emoji: '🌡️', color: '#FF5722', category: 'weather' },
  W: { name: 'NWS Site', emoji: '🌦️', color: '#F4511E', category: 'weather' },

  // Generic
  '/': { name: 'Dot', emoji: '•', color: '#757575', category: 'other' },
  '\\': { name: 'Triangle', emoji: '▲', color: '#757575', category: 'other' },
  '[': { name: 'Human', emoji: '🚶', color: '#8D6E63', category: 'other' },
  ';': { name: 'Person', emoji: '👤', color: '#A1887F', category: 'other' },

  // Numbered overlay symbols (0-9) - typically portable/mobile stations
  '0': { name: 'Circle 0', emoji: '⓪', color: '#607D8B', category: 'other' },
  '1': { name: 'Circle 1', emoji: '①', color: '#607D8B', category: 'other' },
  '2': { name: 'Circle 2', emoji: '②', color: '#607D8B', category: 'other' },
  '3': { name: 'Circle 3', emoji: '③', color: '#607D8B', category: 'other' },
  '4': { name: 'Circle 4', emoji: '④', color: '#607D8B', category: 'other' },
  '5': { name: 'Circle 5', emoji: '⑤', color: '#607D8B', category: 'other' },
  '6': { name: 'Circle 6', emoji: '⑥', color: '#607D8B', category: 'other' },
  '7': { name: 'Circle 7', emoji: '⑦', color: '#607D8B', category: 'other' },
  '8': { name: 'Circle 8', emoji: '⑧', color: '#607D8B', category: 'other' },
  '9': { name: 'Circle 9', emoji: '⑨', color: '#607D8B', category: 'other' },

  // Additional common symbols
  '=': { name: 'Train', emoji: '🚆', color: '#795548', category: 'vehicle' },
  l: { name: 'Laptop', emoji: '💻', color: '#607D8B', category: 'infrastructure' },
  y: { name: 'House (Yagi)', emoji: '🏠', color: '#8BC34A', category: 'infrastructure' },
  '*': { name: 'Star', emoji: '⭐', color: '#FFC107', category: 'other' },
  '.': { name: 'Reserved', emoji: '·', color: '#9E9E9E', category: 'other' },
}

export const MAP_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
export const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
