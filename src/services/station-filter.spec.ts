import { describe, expect, test } from 'vitest'
import type { FilterState, Station } from '../types'
import { filterStations, getStationStats, getUniqueSymbols } from './station-filter'

const createStation = (overrides: Partial<Station> = {}): Station => ({
  callsign: 'TEST-1',
  coordinates: { latitude: 51.5, longitude: -0.1 },
  symbol: '-',
  symbolTable: '/',
  comment: 'Test station',
  lastHeard: new Date(),
  distance: 10,
  bearing: 45,
  packetCount: 1,
  ...overrides,
})

const defaultFilter: FilterState = {
  search: '',
  maxDistance: 600,
  symbolFilter: null,
  hideNoPosition: false,
  sortBy: 'lastHeard',
  sortDirection: 'desc',
  trailMaxAgeHours: 24,
  stationMaxAgeHours: 24,
  rfOnly: false,
}

describe('station filtering', () => {
  const stations: Station[] = [
    createStation({ callsign: 'TEST-0', distance: 5, symbol: '-' }),
    createStation({ callsign: 'G4ABC', distance: 50, symbol: '>' }),
    createStation({ callsign: 'G8XYZ', distance: 100, symbol: '-', comment: 'mobile station' }),
    createStation({ callsign: '2E0TEST', distance: 200, symbol: 'k' }),
  ]

  describe('filterStations', () => {
    test('returns all stations with default filter', () => {
      const result = filterStations(stations, defaultFilter)
      expect(result).toHaveLength(4)
    })

    test('filters by search term in callsign', () => {
      const filter = { ...defaultFilter, search: 'G4' }
      const result = filterStations(stations, filter)
      expect(result).toHaveLength(1)
      expect(result[0]?.callsign).toBe('G4ABC')
    })

    test('filters by search term in comment', () => {
      const filter = { ...defaultFilter, search: 'mobile' }
      const result = filterStations(stations, filter)
      expect(result).toHaveLength(1)
      expect(result[0]?.callsign).toBe('G8XYZ')
    })

    test('filters by maximum distance', () => {
      const filter = { ...defaultFilter, maxDistance: 60 }
      const result = filterStations(stations, filter)
      expect(result).toHaveLength(2)
    })

    test('filters by symbol', () => {
      const filter = { ...defaultFilter, symbolFilter: '-' }
      const result = filterStations(stations, filter)
      expect(result).toHaveLength(2)
    })

    test('sorts by callsign ascending', () => {
      const filter = {
        ...defaultFilter,
        sortBy: 'callsign' as const,
        sortDirection: 'asc' as const,
      }
      const result = filterStations(stations, filter)
      expect(result[0]?.callsign).toBe('2E0TEST')
      expect(result[3]?.callsign).toBe('TEST-0')
    })

    test('sorts by distance descending', () => {
      const filter = {
        ...defaultFilter,
        sortBy: 'distance' as const,
        sortDirection: 'desc' as const,
      }
      const result = filterStations(stations, filter)
      expect(result[0]?.distance).toBe(200)
      expect(result[3]?.distance).toBe(5)
    })

    test('filters RF-only stations (no via path)', () => {
      const stationsWithVia = [
        createStation({ callsign: 'RF-DIRECT', via: [] }),
        createStation({ callsign: 'RF-DIGI', via: ['MB7USE', 'WIDE1-1'] }),
        createStation({ callsign: 'INET-GATED', via: ['TCPIP', 'qAR'] }),
        createStation({ callsign: 'INET-MIXED', via: ['MB7UUE', 'TCPIP*'] }),
      ]
      const filter = { ...defaultFilter, rfOnly: true }
      const result = filterStations(stationsWithVia, filter)
      expect(result).toHaveLength(2)
      expect(result.map((s) => s.callsign)).toContain('RF-DIRECT')
      expect(result.map((s) => s.callsign)).toContain('RF-DIGI')
    })

    test('includes all stations when rfOnly is false', () => {
      const stationsWithVia = [
        createStation({ callsign: 'RF-DIRECT', via: [] }),
        createStation({ callsign: 'INET-GATED', via: ['TCPIP', 'qAR'] }),
      ]
      const filter = { ...defaultFilter, rfOnly: false }
      const result = filterStations(stationsWithVia, filter)
      expect(result).toHaveLength(2)
    })

    test('treats stations without via field as RF-only', () => {
      const stationsNoVia = [
        createStation({ callsign: 'NO-VIA' }), // no via field at all
      ]
      const filter = { ...defaultFilter, rfOnly: true }
      const result = filterStations(stationsNoVia, filter)
      expect(result).toHaveLength(1)
    })

    test('filters various internet gateway markers', () => {
      const stationsWithGateways = [
        createStation({ callsign: 'QAC', via: ['qAC'] }),
        createStation({ callsign: 'QAO', via: ['qAO'] }),
        createStation({ callsign: 'QAS', via: ['qAS'] }),
        createStation({ callsign: 'QAX', via: ['qAX'] }),
        createStation({ callsign: 'QAI', via: ['qAI'] }),
        createStation({ callsign: 'QAZ', via: ['qAZ'] }),
        createStation({ callsign: 'RF-ONLY', via: ['WIDE1-1'] }),
      ]
      const filter = { ...defaultFilter, rfOnly: true }
      const result = filterStations(stationsWithGateways, filter)
      expect(result).toHaveLength(1)
      expect(result[0]?.callsign).toBe('RF-ONLY')
    })
  })

  describe('getUniqueSymbols', () => {
    test('extracts unique symbols', () => {
      const symbols = getUniqueSymbols(stations)
      expect(symbols).toHaveLength(3)
      expect(symbols).toContain('-')
      expect(symbols).toContain('>')
      expect(symbols).toContain('k')
    })

    test('returns sorted symbols', () => {
      const symbols = getUniqueSymbols(stations)
      expect(symbols).toEqual(['-', '>', 'k'])
    })
  })

  describe('getStationStats', () => {
    test('calculates total count', () => {
      const stats = getStationStats(stations)
      expect(stats.total).toBe(4)
    })

    test('calculates average distance', () => {
      const stats = getStationStats(stations)
      expect(stats.avgDistance).toBe((5 + 50 + 100 + 200) / 4)
    })

    test('finds furthest station', () => {
      const stats = getStationStats(stations)
      expect(stats.furthest?.callsign).toBe('2E0TEST')
      expect(stats.furthest?.distance).toBe(200)
    })

    test('handles empty array', () => {
      const stats = getStationStats([])
      expect(stats.total).toBe(0)
      expect(stats.avgDistance).toBe(0)
      expect(stats.furthest).toBeNull()
    })
  })
})
