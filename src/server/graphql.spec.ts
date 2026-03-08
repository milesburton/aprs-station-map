import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./config', () => ({
  config: {
    station: { latitude: 51.5, longitude: -0.1, callsign: 'TEST' },
    aprsIs: {
      server: 'rotate.aprs2.net',
      port: 14580,
      passcode: '-1',
      filter: '',
      reconnectIntervalMs: 30000,
    },
    kiss: { host: 'localhost', port: 8001, reconnectIntervalMs: 5000 },
    dataSource: 'aprs-is',
    database: { path: ':memory:' },
    web: { port: 3001, host: '0.0.0.0' },
    log: { level: 'info' },
  },
}))

vi.mock('./database', () => ({
  getAllStations: vi.fn(() => []),
  getStationByCallsign: vi.fn(() => null),
  getStationHistory: vi.fn(() => []),
  getAllStationHistories: vi.fn(() => ({})),
  getStats: vi.fn(() => ({ totalStations: 0, stationsWithPosition: 0, totalPackets: 0 })),
}))

vi.mock('./state-manager', () => ({
  stateManager: { isKissConnected: vi.fn(() => false) },
}))

import * as db from './database'
import { handleGraphQL } from './graphql'
import { stateManager } from './state-manager'

const makeStation = (overrides = {}): import('./database').DbStation => ({
  id: 1,
  callsign: 'G4ABC',
  latitude: 51.5,
  longitude: -0.1,
  symbol: '-',
  symbol_table: '/',
  comment: 'Test',
  last_heard: Date.now(),
  packet_count: 3,
  last_path: 'WIDE1-1,WIDE2-1',
  created_at: Date.now() - 60000,
  updated_at: Date.now(),
  ...overrides,
})

const makeReq = (method: string, url: string, body?: string): IncomingMessage => {
  const req = new EventEmitter() as IncomingMessage
  req.method = method
  req.url = url
  req.headers = { host: 'localhost' }
  if (body) {
    process.nextTick(() => {
      req.emit('data', Buffer.from(body))
      req.emit('end')
    })
  }
  return req
}

const makeRes = () => {
  const chunks: string[] = []
  let statusCode = 200
  let headers: Record<string, string> = {}
  const res = {
    writeHead: vi.fn((code: number, h?: Record<string, string>) => {
      statusCode = code
      headers = h ?? {}
    }),
    end: vi.fn((data?: string) => {
      if (data) chunks.push(data)
    }),
    getStatus: () => statusCode,
    getBody: () => JSON.parse(chunks.join('')) as unknown,
    getHeaders: () => headers,
  }
  return res as unknown as ServerResponse & typeof res
}

describe('handleGraphQL', () => {
  beforeEach(() => {
    vi.mocked(db.getAllStations).mockReturnValue([])
    vi.mocked(db.getStationByCallsign).mockReturnValue(null)
    vi.mocked(db.getStats).mockReturnValue({
      totalStations: 0,
      stationsWithPosition: 0,
      totalPackets: 0,
      totalVessels: 0,
      vesselsWithPosition: 0,
    })
    vi.mocked(stateManager.isKissConnected).mockReturnValue(false)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('handles OPTIONS preflight with CORS headers', async () => {
    const req = makeReq('OPTIONS', '/graphql')
    const res = makeRes()
    await handleGraphQL(req, res)
    expect(res.writeHead).toHaveBeenCalledWith(
      204,
      expect.objectContaining({
        'Access-Control-Allow-Origin': '*',
      })
    )
  })

  it('rejects unsupported HTTP methods', async () => {
    const req = makeReq('DELETE', '/graphql')
    const res = makeRes()
    await handleGraphQL(req, res)
    expect(res.getStatus()).toBe(405)
  })

  it('returns 400 when GET request has no query parameter', async () => {
    const req = makeReq('GET', '/graphql')
    const res = makeRes()
    await handleGraphQL(req, res)
    expect(res.getStatus()).toBe(400)
  })

  it('returns 400 for invalid variables JSON in GET request', async () => {
    const req = makeReq('GET', '/graphql?query={stats{totalStations}}&variables=notjson')
    const res = makeRes()
    await handleGraphQL(req, res)
    expect(res.getStatus()).toBe(400)
  })

  it('returns 400 when POST body is not valid JSON', async () => {
    const req = makeReq('POST', '/graphql', 'not-json')
    const res = makeRes()
    await handleGraphQL(req, res)
    expect(res.getStatus()).toBe(400)
  })

  it('returns 400 when POST body has no query field', async () => {
    const req = makeReq('POST', '/graphql', JSON.stringify({ variables: {} }))
    const res = makeRes()
    await handleGraphQL(req, res)
    expect(res.getStatus()).toBe(400)
  })

  it('resolves stats query via GET', async () => {
    vi.mocked(db.getStats).mockReturnValue({
      totalStations: 5,
      stationsWithPosition: 3,
      totalPackets: 42,
      totalVessels: 0,
      vesselsWithPosition: 0,
    })
    vi.mocked(stateManager.isKissConnected).mockReturnValue(true)
    const req = makeReq(
      'GET',
      '/graphql?query={stats{totalStations,stationsWithPosition,totalPackets,kissConnected}}'
    )
    const res = makeRes()
    await handleGraphQL(req, res)
    const body = res.getBody() as { data: { stats: Record<string, unknown> } }
    expect(body.data.stats.totalStations).toBe(5)
    expect(body.data.stats.stationsWithPosition).toBe(3)
    expect(body.data.stats.totalPackets).toBe(42)
    expect(body.data.stats.kissConnected).toBe(true)
  })

  it('resolves health query', async () => {
    const req = makeReq('GET', '/graphql?query={health{status,kissConnected}}')
    const res = makeRes()
    await handleGraphQL(req, res)
    const body = res.getBody() as { data: { health: Record<string, unknown> } }
    expect(body.data.health.status).toBe('ok')
    expect(body.data.health.kissConnected).toBe(false)
  })

  it('resolves stations query with no stations', async () => {
    const req = makeReq('GET', '/graphql?query={stations{callsign}}')
    const res = makeRes()
    await handleGraphQL(req, res)
    const body = res.getBody() as { data: { stations: unknown[] } }
    expect(body.data.stations).toEqual([])
  })

  it('resolves stations query with data', async () => {
    vi.mocked(db.getAllStations).mockReturnValue([makeStation()])
    const req = makeReq(
      'GET',
      '/graphql?query={stations{callsign,symbol,distanceKm,bearingDeg,via}}'
    )
    const res = makeRes()
    await handleGraphQL(req, res)
    const body = res.getBody() as { data: { stations: Array<Record<string, unknown>> } }
    expect(body.data.stations).toHaveLength(1)
    expect(body.data.stations[0]?.callsign).toBe('G4ABC')
    expect(body.data.stations[0]?.via).toEqual(['WIDE1-1', 'WIDE2-1'])
  })

  it('filters stations by search term', async () => {
    vi.mocked(db.getAllStations).mockReturnValue([
      makeStation({ callsign: 'G4ABC' }),
      makeStation({ callsign: 'M0XYZ', id: 2 }),
    ])
    const req = makeReq('GET', '/graphql?query={stations(search:"G4"){callsign}}')
    const res = makeRes()
    await handleGraphQL(req, res)
    const body = res.getBody() as { data: { stations: Array<{ callsign: string }> } }
    expect(body.data.stations).toHaveLength(1)
    expect(body.data.stations[0]?.callsign).toBe('G4ABC')
  })

  it('resolves station query returns null for unknown callsign', async () => {
    const req = makeReq('GET', '/graphql?query={station(callsign:"NOCALL"){callsign}}')
    const res = makeRes()
    await handleGraphQL(req, res)
    const body = res.getBody() as { data: { station: unknown } }
    expect(body.data.station).toBeNull()
  })

  it('resolves station query returns station when found', async () => {
    vi.mocked(db.getStationByCallsign).mockReturnValue(makeStation())
    vi.mocked(db.getStationHistory).mockReturnValue([])
    const req = makeReq('GET', '/graphql?query={station(callsign:"G4ABC"){callsign,packetCount}}')
    const res = makeRes()
    await handleGraphQL(req, res)
    const body = res.getBody() as { data: { station: Record<string, unknown> } }
    expect(body.data.station?.callsign).toBe('G4ABC')
    expect(body.data.station?.packetCount).toBe(3)
  })

  it('resolves stationHistory query returns empty array for unknown station', async () => {
    const req = makeReq('GET', '/graphql?query={stationHistory(callsign:"NOCALL"){id}}')
    const res = makeRes()
    await handleGraphQL(req, res)
    const body = res.getBody() as { data: { stationHistory: unknown[] } }
    expect(body.data.stationHistory).toEqual([])
  })

  it('handles POST request with JSON body', async () => {
    vi.mocked(db.getStats).mockReturnValue({
      totalStations: 1,
      stationsWithPosition: 1,
      totalPackets: 10,
      totalVessels: 0,
      vesselsWithPosition: 0,
    })
    const body = JSON.stringify({ query: '{ stats { totalStations } }' })
    const req = makeReq('POST', '/graphql', body)
    const res = makeRes()
    await handleGraphQL(req, res)
    const respBody = res.getBody() as { data: { stats: { totalStations: number } } }
    expect(respBody.data.stats.totalStations).toBe(1)
  })

  it('resolves stations without position when withPositionOnly is false', async () => {
    vi.mocked(db.getAllStations).mockReturnValue([makeStation({ latitude: null, longitude: null })])
    const req = makeReq('GET', '/graphql?query={stations{callsign,distanceKm}}')
    const res = makeRes()
    await handleGraphQL(req, res)
    const body = res.getBody() as { data: { stations: Array<Record<string, unknown>> } }
    expect(body.data.stations).toHaveLength(1)
    expect(body.data.stations[0]?.distanceKm).toBeNull()
  })

  it('filters out stations without position when withPositionOnly is true', async () => {
    vi.mocked(db.getAllStations).mockReturnValue([
      makeStation({ id: 1, callsign: 'G4ABC', latitude: 51.5, longitude: -0.1 }),
      makeStation({ id: 2, callsign: 'M0XYZ', latitude: null, longitude: null }),
    ])
    const req = makeReq('GET', '/graphql?query={stations(withPositionOnly:true){callsign}}')
    const res = makeRes()
    await handleGraphQL(req, res)
    const body = res.getBody() as { data: { stations: Array<{ callsign: string }> } }
    expect(body.data.stations).toHaveLength(1)
    expect(body.data.stations[0]?.callsign).toBe('G4ABC')
  })

  it('sets CORS headers on successful response', async () => {
    const req = makeReq('GET', '/graphql?query={health{status}}')
    const res = makeRes()
    await handleGraphQL(req, res)
    const headers = res.getHeaders()
    expect(headers['Access-Control-Allow-Origin']).toBe('*')
  })
})
