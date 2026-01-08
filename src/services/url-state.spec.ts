import { describe, expect, test } from 'vitest'
import { DEFAULT_CONFIG, DEFAULT_FILTER_STATE } from '../constants'
import type { FilterState, MapState } from '../types'
import { decodeUrlState, encodeUrlState } from './url-state'

describe('URL state management', () => {
  const defaultMapState: MapState = {
    centre: DEFAULT_CONFIG.stationLocation,
    zoom: DEFAULT_CONFIG.defaultZoom,
    selectedStation: null,
  }

  describe('encodeUrlState', () => {
    test('encodes search query', () => {
      const filter: FilterState = { ...DEFAULT_FILTER_STATE, search: 'TEST-1' }
      const encoded = encodeUrlState(filter, defaultMapState)
      expect(encoded).toContain('q=TEST-1')
    })

    test('encodes non-default distance', () => {
      const filter: FilterState = { ...DEFAULT_FILTER_STATE, maxDistance: 100 }
      const encoded = encodeUrlState(filter, defaultMapState)
      expect(encoded).toContain('d=100')
    })

    test('encodes symbol filter', () => {
      const filter: FilterState = { ...DEFAULT_FILTER_STATE, symbolFilter: '>' }
      const encoded = encodeUrlState(filter, defaultMapState)
      expect(encoded).toContain('sym=%3E')
    })

    test('encodes selected station', () => {
      const mapState: MapState = { ...defaultMapState, selectedStation: 'G4ABC' }
      const encoded = encodeUrlState(DEFAULT_FILTER_STATE, mapState)
      expect(encoded).toContain('station=G4ABC')
    })

    test('encodes map position', () => {
      const mapState: MapState = {
        centre: { latitude: 52.1234, longitude: -1.5678 },
        zoom: 12,
        selectedStation: null,
      }
      const encoded = encodeUrlState(DEFAULT_FILTER_STATE, mapState)
      expect(encoded).toContain('lat=52.1234')
      expect(encoded).toContain('lng=-1.5678')
      expect(encoded).toContain('z=12')
    })

    test('encodes sort and direction', () => {
      const filter: FilterState = {
        ...DEFAULT_FILTER_STATE,
        sortBy: 'distance',
        sortDirection: 'asc',
      }
      const encoded = encodeUrlState(filter, defaultMapState)
      expect(encoded).toContain('sort=distance')
      expect(encoded).toContain('dir=asc')
    })

    test('does not encode default values', () => {
      const encoded = encodeUrlState(DEFAULT_FILTER_STATE, defaultMapState)
      expect(encoded).not.toContain('sort=')
      expect(encoded).not.toContain('d=')
    })
  })

  describe('decodeUrlState', () => {
    test('decodes search query', () => {
      const decoded = decodeUrlState('?q=TEST-1')
      expect(decoded.filter.search).toBe('TEST-1')
    })

    test('decodes distance', () => {
      const decoded = decodeUrlState('?d=100')
      expect(decoded.filter.maxDistance).toBe(100)
    })

    test('decodes symbol filter', () => {
      const decoded = decodeUrlState('?sym=%3E')
      expect(decoded.filter.symbolFilter).toBe('>')
    })

    test('decodes selected station', () => {
      const decoded = decodeUrlState('?station=G4ABC')
      expect(decoded.map.selectedStation).toBe('G4ABC')
    })

    test('decodes map position', () => {
      const decoded = decodeUrlState('?lat=52.1234&lng=-1.5678&z=12')
      expect(decoded.map.centre?.latitude).toBe(52.1234)
      expect(decoded.map.centre?.longitude).toBe(-1.5678)
      expect(decoded.map.zoom).toBe(12)
    })

    test('decodes sort parameters', () => {
      const decoded = decodeUrlState('?sort=distance&dir=asc')
      expect(decoded.filter.sortBy).toBe('distance')
      expect(decoded.filter.sortDirection).toBe('asc')
    })

    test('handles empty search', () => {
      const decoded = decodeUrlState('')
      expect(decoded.filter.search).toBeUndefined()
      expect(decoded.map.selectedStation).toBeUndefined()
    })

    test('handles missing map coordinates', () => {
      const decoded = decodeUrlState('?q=test')
      expect(decoded.map.centre).toBeUndefined()
    })

    test('handles partial map coordinates', () => {
      const decoded = decodeUrlState('?lat=52.1234')
      expect(decoded.map.centre).toBeUndefined()
    })
  })
})
