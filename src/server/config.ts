export type DataSource = 'kiss' | 'aprs-is'
export type AisSource = 'kiss' | 'http' | 'none'

export interface ServerConfig {
  dataSource: DataSource
  kissEnabled: boolean
  aprsIsEnabled: boolean
  kiss: {
    host: string
    port: number
    reconnectIntervalMs: number
  }
  aprsIs: {
    server: string
    port: number
    passcode: string
    filter: string
    reconnectIntervalMs: number
  }
  ais: {
    source: AisSource
    kiss: {
      host: string
      port: number
      reconnectIntervalMs: number
    }
    http: {
      enabled: boolean
      apiUrl: string
      updateIntervalMs: number
    }
  }
  database: {
    path: string
  }
  web: {
    port: number
    host: string
  }
  station: {
    latitude: number
    longitude: number
    callsign: string
  }
  log: {
    level: 'debug' | 'info' | 'warn' | 'error'
  }
}

const parseNumber = (value: string | undefined, defaultValue: number): number => {
  if (value == null || value.trim() === '') return defaultValue
  const parsed = Number(value)
  return Number.isNaN(parsed) ? defaultValue : parsed
}

const DEFAULT_STATION_LAT = 51.4416
const DEFAULT_STATION_LON = 0.15

const parseBool = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value == null) return defaultValue
  const v = value.trim().toLowerCase()
  if (v === '') return defaultValue
  if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false
  return defaultValue
}

export const loadConfig = (): ServerConfig => {
  const stationLatitude = parseNumber(process.env.STATION_LATITUDE, DEFAULT_STATION_LAT)
  const stationLongitude = parseNumber(process.env.STATION_LONGITUDE, DEFAULT_STATION_LON)
  const configuredAprsFilter = process.env.APRS_IS_FILTER?.trim()
  const aprsFilter =
    configuredAprsFilter && configuredAprsFilter.length > 0
      ? configuredAprsFilter
      : `r/${stationLatitude.toFixed(4)}/${stationLongitude.toFixed(4)}/600`

  const dataSource: DataSource =
    (process.env.DATA_SOURCE as DataSource) === 'aprs-is' ? 'aprs-is' : 'kiss'

  // KISS_ENABLED / APRS_IS_ENABLED let you run both sources at once. When
  // unset they fall back to whichever DATA_SOURCE is selected, preserving the
  // single-source behaviour of older deployments.
  const kissEnabled = parseBool(process.env.KISS_ENABLED, dataSource === 'kiss')
  const aprsIsEnabled = parseBool(process.env.APRS_IS_ENABLED, dataSource === 'aprs-is')

  return {
    dataSource,
    kissEnabled,
    aprsIsEnabled,
    kiss: {
      host: process.env.KISS_HOST ?? 'localhost',
      port: parseNumber(process.env.KISS_PORT, 8001),
      reconnectIntervalMs: parseNumber(process.env.KISS_RECONNECT_MS, 5000),
    },
    aprsIs: {
      server: process.env.APRS_IS_SERVER ?? 'rotate.aprs2.net',
      port: parseNumber(process.env.APRS_IS_PORT, 14580),
      passcode: process.env.APRS_IS_PASSCODE ?? '-1',
      filter: aprsFilter,
      reconnectIntervalMs: parseNumber(process.env.APRS_IS_RECONNECT_MS, 30000),
    },
    ais: {
      source: (process.env.AIS_SOURCE as AisSource) ?? 'none',
      kiss: {
        host: process.env.AIS_KISS_HOST ?? 'localhost',
        port: parseNumber(process.env.AIS_KISS_PORT, 8002),
        reconnectIntervalMs: parseNumber(process.env.AIS_KISS_RECONNECT_MS, 5000),
      },
      http: {
        enabled: process.env.AIS_HTTP_ENABLED === 'true',
        apiUrl: process.env.AIS_HTTP_API_URL ?? 'https://api.maritimetraffic.com',
        updateIntervalMs: parseNumber(process.env.AIS_HTTP_UPDATE_MS, 30000),
      },
    },
    database: {
      path: process.env.DATABASE_PATH ?? './data/stations.db',
    },
    web: {
      port: parseNumber(process.env.WEB_PORT, 3001),
      host: process.env.WEB_HOST ?? '0.0.0.0',
    },
    station: {
      latitude: stationLatitude,
      longitude: stationLongitude,
      callsign: process.env.STATION_CALLSIGN ?? 'N0CALL',
    },
    log: {
      level: (process.env.LOG_LEVEL as ServerConfig['log']['level']) ?? 'info',
    },
  }
}

export const config = loadConfig()
