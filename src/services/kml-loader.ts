import { kml } from '@tmcw/togeojson'
import { DEFAULT_CONFIG } from '../constants'
import type { Coordinates, KmlLoadResult, Station } from '../types'
import {
  calculateBearing,
  calculateDistance,
  isPlausibleLocation,
  logger,
  parseKmlTimestamp,
} from '../utils'

interface GeoJsonFeature {
  type: 'Feature'
  geometry: {
    type: string
    coordinates: number[]
  }
  properties: Record<string, unknown>
}

interface GeoJsonCollection {
  type: 'FeatureCollection'
  features: GeoJsonFeature[]
}

const parseDescription = (
  description: string | undefined
): { comment: string; symbol: string; via: string[] } => {
  const lines = (description ?? '').split('<br>')
  const comment = lines[0] ?? ''
  const symbol =
    lines
      .find((l) => l.startsWith('Symbol:'))
      ?.replace('Symbol:', '')
      .trim() ?? '-'
  const viaLine = lines.find((l) => l.startsWith('Via:'))
  const via = viaLine ? viaLine.replace('Via:', '').trim().split(',') : []
  return { comment, symbol, via }
}

const featureToStation = (
  feature: GeoJsonFeature,
  referenceLocation: Coordinates
): Station | null => {
  const { geometry, properties } = feature

  const isPoint = geometry.type === 'Point'
  const hasCoords = Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2

  const coords: Coordinates | null =
    isPoint && hasCoords
      ? { longitude: geometry.coordinates[0] ?? 0, latitude: geometry.coordinates[1] ?? 0 }
      : null

  const isValid =
    coords !== null && isPlausibleLocation(coords, referenceLocation, DEFAULT_CONFIG.maxDistanceKm)

  const { comment, symbol, via } = parseDescription(properties.description as string | undefined)

  return isValid && coords
    ? {
        callsign: (properties.name as string) ?? 'UNKNOWN',
        coordinates: coords,
        symbol,
        comment,
        lastHeard: parseKmlTimestamp(properties.timestamp as string | undefined),
        distance: calculateDistance(referenceLocation, coords),
        bearing: calculateBearing(referenceLocation, coords),
        via,
      }
    : null
}

export const parseKml = (kmlText: string, referenceLocation: Coordinates): Station[] => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(kmlText, 'text/xml')
  const geojson = kml(doc) as GeoJsonCollection

  const stations = geojson.features
    .map((feature) => featureToStation(feature, referenceLocation))
    .filter((station): station is Station => station !== null)

  logger.debug({ count: stations.length }, 'Parsed stations from KML')
  return stations
}

export const fetchKml = async (url: string): Promise<string> => {
  const response = await fetch(url)
  const ok = response.ok
  ok
    ? logger.info({ url }, 'KML fetched successfully')
    : logger.error({ url, status: response.status }, 'KML fetch failed')
  return ok ? response.text() : Promise.reject(new Error(`Failed to fetch KML: ${response.status}`))
}

export const loadStations = async (
  url: string = DEFAULT_CONFIG.kmlUrl,
  referenceLocation: Coordinates = DEFAULT_CONFIG.stationLocation
): Promise<KmlLoadResult> => {
  try {
    const kmlText = await fetchKml(url)
    const stations = parseKml(kmlText, referenceLocation)
    return { stations, loadedAt: new Date() }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error({ error: message }, 'Failed to load stations')
    return { stations: [], loadedAt: new Date(), error: message }
  }
}
