import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadConfig } from './config'

describe('loadConfig', () => {
  const original = { ...process.env }

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (
        key.startsWith('DATA_SOURCE') ||
        key.startsWith('KISS') ||
        key.startsWith('APRS') ||
        key.startsWith('DATABASE') ||
        key.startsWith('WEB') ||
        key.startsWith('STATION') ||
        key.startsWith('LOG')
      ) {
        delete process.env[key]
      }
    }
  })

  afterEach(() => {
    Object.assign(process.env, original)
  })

  it('defaults to kiss data source when DATA_SOURCE is unset', () => {
    expect(loadConfig().dataSource).toBe('kiss')
  })

  it('returns aprs-is when DATA_SOURCE=aprs-is', () => {
    process.env.DATA_SOURCE = 'aprs-is'
    expect(loadConfig().dataSource).toBe('aprs-is')
  })

  it('defaults to kiss for any unrecognised DATA_SOURCE value', () => {
    process.env.DATA_SOURCE = 'unknown'
    expect(loadConfig().dataSource).toBe('kiss')
  })

  it('applies default KISS settings', () => {
    const { kiss } = loadConfig()
    expect(kiss.host).toBe('localhost')
    expect(kiss.port).toBe(8001)
    expect(kiss.reconnectIntervalMs).toBe(5000)
  })

  it('reads KISS settings from environment', () => {
    process.env.KISS_HOST = '192.168.1.10'
    process.env.KISS_PORT = '8888'
    process.env.KISS_RECONNECT_MS = '10000'
    const { kiss } = loadConfig()
    expect(kiss.host).toBe('192.168.1.10')
    expect(kiss.port).toBe(8888)
    expect(kiss.reconnectIntervalMs).toBe(10000)
  })

  it('applies default APRS-IS settings', () => {
    const { aprsIs } = loadConfig()
    expect(aprsIs.server).toBe('rotate.aprs2.net')
    expect(aprsIs.port).toBe(14580)
    expect(aprsIs.passcode).toBe('-1')
    expect(aprsIs.filter).toBe('r/51.4416/0.1500/600')
    expect(aprsIs.reconnectIntervalMs).toBe(30000)
  })

  it('reads APRS-IS settings from environment', () => {
    process.env.APRS_IS_SERVER = 'euro.aprs2.net'
    process.env.APRS_IS_PORT = '14581'
    process.env.APRS_IS_PASSCODE = '12345'
    process.env.APRS_IS_FILTER = 'r/51.5/-0.1/200'
    const { aprsIs } = loadConfig()
    expect(aprsIs.server).toBe('euro.aprs2.net')
    expect(aprsIs.port).toBe(14581)
    expect(aprsIs.passcode).toBe('12345')
    expect(aprsIs.filter).toBe('r/51.5/-0.1/200')
  })

  it('applies default station settings', () => {
    const { station } = loadConfig()
    expect(station.latitude).toBe(51.4416)
    expect(station.longitude).toBe(0.15)
    expect(station.callsign).toBe('NOCALL')
  })

  it('derives APRS-IS filter from station coordinates when APRS_IS_FILTER is unset', () => {
    process.env.STATION_LATITUDE = '40.7128'
    process.env.STATION_LONGITUDE = '-74.0060'
    expect(loadConfig().aprsIs.filter).toBe('r/40.7128/-74.0060/600')
  })

  it('reads station settings from environment', () => {
    process.env.STATION_LATITUDE = '51.5'
    process.env.STATION_LONGITUDE = '-0.1'
    process.env.STATION_CALLSIGN = 'M0LHA-10'
    const { station } = loadConfig()
    expect(station.latitude).toBe(51.5)
    expect(station.longitude).toBe(-0.1)
    expect(station.callsign).toBe('M0LHA-10')
  })

  it('applies default web settings', () => {
    const { web } = loadConfig()
    expect(web.port).toBe(3001)
    expect(web.host).toBe('0.0.0.0')
  })

  it('reads web settings from environment', () => {
    process.env.WEB_PORT = '8080'
    process.env.WEB_HOST = '127.0.0.1'
    const { web } = loadConfig()
    expect(web.port).toBe(8080)
    expect(web.host).toBe('127.0.0.1')
  })

  it('applies default log level of info', () => {
    expect(loadConfig().log.level).toBe('info')
  })

  it('reads LOG_LEVEL from environment', () => {
    process.env.LOG_LEVEL = 'debug'
    expect(loadConfig().log.level).toBe('debug')
  })

  it('falls back to default for non-numeric port values', () => {
    process.env.KISS_PORT = 'not-a-number'
    expect(loadConfig().kiss.port).toBe(8001)
  })

  it('applies default database path', () => {
    expect(loadConfig().database.path).toBe('./data/stations.db')
  })

  it('reads DATABASE_PATH from environment', () => {
    process.env.DATABASE_PATH = '/tmp/test.db'
    expect(loadConfig().database.path).toBe('/tmp/test.db')
  })
})
