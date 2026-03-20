import { describe, expect, test } from 'vitest'
import type { Coordinates } from '../types'
import { formatBearing, formatDistance, isPlausibleLocation, isValidCoordinate } from './geo'

// Note: calculateDistance and calculateBearing are tested in src/server/geo.spec.ts

const london: Coordinates = { latitude: 51.5074, longitude: -0.1278 }
const paris: Coordinates = { latitude: 48.8566, longitude: 2.3522 }
const newYork: Coordinates = { latitude: 40.7128, longitude: -74.006 }

describe('formatDistance', () => {
  test('formats sub-km distances in metres', () => {
    expect(formatDistance(0.5)).toBe('500 m')
    expect(formatDistance(0.1)).toBe('100 m')
  })

  test('formats km distances to one decimal place', () => {
    expect(formatDistance(1.5)).toBe('1.5 km')
    expect(formatDistance(100)).toBe('100.0 km')
  })
})

describe('formatBearing', () => {
  test('cardinal directions', () => {
    expect(formatBearing(0)).toBe('N')
    expect(formatBearing(90)).toBe('E')
    expect(formatBearing(180)).toBe('S')
    expect(formatBearing(270)).toBe('W')
  })

  test('intercardinal directions', () => {
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

  test('rejects null island (0, 0)', () => {
    expect(isValidCoordinate({ latitude: 0, longitude: 0 })).toBe(false)
  })

  test('rejects out-of-range values', () => {
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
