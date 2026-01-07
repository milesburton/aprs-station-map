import { EARTH_RADIUS_KM } from '../constants'
import type { Coordinates } from '../types'

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180

const toDegrees = (radians: number): number => (radians * 180) / Math.PI

export const calculateDistance = (from: Coordinates, to: Coordinates): number => {
  const lat1 = toRadians(from.latitude)
  const lat2 = toRadians(to.latitude)
  const deltaLat = toRadians(to.latitude - from.latitude)
  const deltaLon = toRadians(to.longitude - from.longitude)

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS_KM * c
}

export const calculateBearing = (from: Coordinates, to: Coordinates): number => {
  const lat1 = toRadians(from.latitude)
  const lat2 = toRadians(to.latitude)
  const deltaLon = toRadians(to.longitude - from.longitude)

  const y = Math.sin(deltaLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon)

  const bearing = toDegrees(Math.atan2(y, x))
  return (bearing + 360) % 360
}

export const formatDistance = (km: number): string =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`

export const formatBearing = (bearing: number): string => {
  const directions = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ]
  const index = Math.round(bearing / 22.5) % 16
  return directions[index] ?? 'N'
}

export const isValidCoordinate = (coord: Coordinates): boolean =>
  coord.latitude >= -90 &&
  coord.latitude <= 90 &&
  coord.longitude >= -180 &&
  coord.longitude <= 180 &&
  !(coord.latitude === 0 && coord.longitude === 0)

export const isPlausibleLocation = (
  coord: Coordinates,
  reference: Coordinates,
  maxKm: number
): boolean => isValidCoordinate(coord) && calculateDistance(reference, coord) <= maxKm
