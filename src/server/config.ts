export type DataSource = 'kiss' | 'aprs-is'

export interface ServerConfig {
  dataSource: DataSource
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
  const parsed = Number(value)
  return Number.isNaN(parsed) ? defaultValue : parsed
}

export const loadConfig = (): ServerConfig => ({
  dataSource: (process.env.DATA_SOURCE as DataSource) === 'aprs-is' ? 'aprs-is' : 'kiss',
  kiss: {
    host: process.env.KISS_HOST ?? 'localhost',
    port: parseNumber(process.env.KISS_PORT, 8001),
    reconnectIntervalMs: parseNumber(process.env.KISS_RECONNECT_MS, 5000),
  },
  aprsIs: {
    server: process.env.APRS_IS_SERVER ?? 'rotate.aprs2.net',
    port: parseNumber(process.env.APRS_IS_PORT, 14580),
    passcode: process.env.APRS_IS_PASSCODE ?? '-1',
    filter: process.env.APRS_IS_FILTER ?? '',
    reconnectIntervalMs: parseNumber(process.env.APRS_IS_RECONNECT_MS, 30000),
  },
  database: {
    path: process.env.DATABASE_PATH ?? './data/stations.db',
  },
  web: {
    port: parseNumber(process.env.WEB_PORT, 3001),
    host: process.env.WEB_HOST ?? '0.0.0.0',
  },
  station: {
    latitude: parseNumber(process.env.STATION_LATITUDE, 0),
    longitude: parseNumber(process.env.STATION_LONGITUDE, 0),
    callsign: process.env.STATION_CALLSIGN ?? 'NOCALL',
  },
  log: {
    level: (process.env.LOG_LEVEL as ServerConfig['log']['level']) ?? 'info',
  },
})

export const config = loadConfig()
