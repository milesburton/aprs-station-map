import type { AppConfig, Coordinates, FilterState } from './types'

export const BEXLEY_LOCATION: Coordinates = {
  latitude: 51.4416,
  longitude: 0.15,
}

export const DEFAULT_CONFIG: AppConfig = {
  apiUrl: '/api',
  wsUrl: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`,
  stationLocation: BEXLEY_LOCATION,
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
}

export const EARTH_RADIUS_KM = 6371

export const APRS_SYMBOLS: Record<string, string> = {
  '-': 'House',
  '>': 'Car',
  k: 'Truck',
  b: 'Bicycle',
  R: 'Recreational vehicle',
  Y: 'Yacht',
  s: 'Boat',
  a: 'Ambulance',
  f: 'Fire truck',
  u: 'Bus',
  j: 'Jeep',
  v: 'Van',
  p: 'Police',
  U: 'School bus',
  O: 'Balloon',
  "'": 'Aircraft',
  '^': 'Large aircraft',
  X: 'Helicopter',
  _: 'Weather station',
  W: 'National Weather Service',
  '/': 'Dot',
  '\\': 'Triangle',
  n: 'Node',
  '#': 'Digipeater',
  '&': 'Gateway',
  I: 'TCP/IP station',
  r: 'Repeater',
  c: 'Incident command post',
  '?': 'Server',
}

export const MAP_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
export const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
