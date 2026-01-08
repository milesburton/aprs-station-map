import { describe, expect, test } from 'vitest'
import {
  filterStations,
  getStationStats,
  getUniqueSymbols,
} from '../../src/services/station-filter'
import type { FilterState, Station } from '../../src/types'

const createStation = (overrides: Partial<Station> = {}): Station => ({
  callsign: 'TEST-1',
  coordinates: { latitude: 51.5, longitude: -0.1 },
  symbol: '-',
  comment: 'Test station',
  lastHeard: new Date(),
  distance: 10,
  bearing: 45,
  ...overrides,
})

const defaultFilter: FilterState = {
  search: '',
  maxDistance: 600,
  symbolFilter: null,
  hideNoPosition: false,
  sortBy: 'lastHeard',
  sortDirection: 'desc',
}

describe('station filtering', () => {
  const stations: Station[] = [
    createStation({ callsign: 'M0LHA', distance: 5, symbol: '-' }),
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
      expect(result[3]?.callsign).toBe('M0LHA')
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
