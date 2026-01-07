import { describe, expect, test } from 'bun:test'
import type { Coordinates } from '../../src/types'
import {
  calculateBearing,
  calculateDistance,
  formatBearing,
  formatDistance,
  isPlausibleLocation,
  isValidCoordinate,
} from '../../src/utils/geo'

describe('geo utilities', () => {
  const london: Coordinates = { latitude: 51.5074, longitude: -0.1278 }
  const paris: Coordinates = { latitude: 48.8566, longitude: 2.3522 }
  const newYork: Coordinates = { latitude: 40.7128, longitude: -74.006 }

  describe('calculateDistance', () => {
    test('calculates distance between London and Paris', () => {
      const distance = calculateDistance(london, paris)
      expect(distance).toBeGreaterThan(340)
      expect(distance).toBeLessThan(350)
    })

    test('calculates distance between London and New York', () => {
      const distance = calculateDistance(london, newYork)
      expect(distance).toBeGreaterThan(5550)
      expect(distance).toBeLessThan(5600)
    })

    test('returns zero for same location', () => {
      const distance = calculateDistance(london, london)
      expect(distance).toBe(0)
    })
  })

  describe('calculateBearing', () => {
    test('calculates bearing from London to Paris (roughly ESE)', () => {
      const bearing = calculateBearing(london, paris)
      expect(bearing).toBeGreaterThan(140)
      expect(bearing).toBeLessThan(160)
    })

    test('calculates bearing from London to New York (roughly W)', () => {
      const bearing = calculateBearing(london, newYork)
      expect(bearing).toBeGreaterThan(280)
      expect(bearing).toBeLessThan(300)
    })
  })

  describe('formatDistance', () => {
    test('formats small distances in metres', () => {
      expect(formatDistance(0.5)).toBe('500 m')
      expect(formatDistance(0.1)).toBe('100 m')
    })

    test('formats larger distances in kilometres', () => {
      expect(formatDistance(1.5)).toBe('1.5 km')
      expect(formatDistance(100)).toBe('100.0 km')
    })
  })

  describe('formatBearing', () => {
    test('formats cardinal directions', () => {
      expect(formatBearing(0)).toBe('N')
      expect(formatBearing(90)).toBe('E')
      expect(formatBearing(180)).toBe('S')
      expect(formatBearing(270)).toBe('W')
    })

    test('formats intercardinal directions', () => {
      expect(formatBearing(45)).toBe('NE')
      expect(formatBearing(135)).toBe('SE')
      expect(formatBearing(225)).toBe('SW')
      expect(formatBearing(315)).toBe('NW')
    })
  })

  describe('isValidCoordinate', () => {
    test('accepts valid coordinates', () => {
      expect(isValidCoordinate(london)).toBe(true)
      expect(isValidCoordinate({ latitude: -45, longitude: 170 })).toBe(true)
    })

    test('rejects null island (0,0)', () => {
      expect(isValidCoordinate({ latitude: 0, longitude: 0 })).toBe(false)
    })

    test('rejects out of range coordinates', () => {
      expect(isValidCoordinate({ latitude: 91, longitude: 0 })).toBe(false)
      expect(isValidCoordinate({ latitude: 0, longitude: 181 })).toBe(false)
    })
  })

  describe('isPlausibleLocation', () => {
    test('accepts locations within range', () => {
      expect(isPlausibleLocation(paris, london, 500)).toBe(true)
    })

    test('rejects locations outside range', () => {
      expect(isPlausibleLocation(newYork, london, 500)).toBe(false)
    })

    test('rejects invalid coordinates', () => {
      expect(isPlausibleLocation({ latitude: 0, longitude: 0 }, london, 10000)).toBe(false)
    })
  })
})
