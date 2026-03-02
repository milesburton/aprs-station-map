import { describe, expect, it } from 'vitest'
import { calculateBearing, calculateDistance } from './geo'

describe('server geo utilities', () => {
  const london = { latitude: 51.5074, longitude: -0.1278 }
  const paris = { latitude: 48.8566, longitude: 2.3522 }
  const newYork = { latitude: 40.7128, longitude: -74.006 }

  describe('calculateDistance', () => {
    it('calculates distance between London and Paris', () => {
      const dist = calculateDistance(london, paris)
      expect(dist).toBeGreaterThan(340)
      expect(dist).toBeLessThan(350)
    })

    it('calculates distance between London and New York', () => {
      const dist = calculateDistance(london, newYork)
      expect(dist).toBeGreaterThan(5550)
      expect(dist).toBeLessThan(5600)
    })

    it('returns zero for same location', () => {
      expect(calculateDistance(london, london)).toBe(0)
    })

    it('is symmetric (A→B ≈ B→A)', () => {
      const ab = calculateDistance(london, paris)
      const ba = calculateDistance(paris, london)
      expect(ab).toBeCloseTo(ba, 5)
    })
  })

  describe('calculateBearing', () => {
    it('calculates bearing from London to Paris (roughly SE)', () => {
      const bearing = calculateBearing(london, paris)
      expect(bearing).toBeGreaterThan(140)
      expect(bearing).toBeLessThan(160)
    })

    it('calculates bearing from London to New York (roughly W)', () => {
      const bearing = calculateBearing(london, newYork)
      expect(bearing).toBeGreaterThan(280)
      expect(bearing).toBeLessThan(300)
    })

    it('returns a value in [0, 360)', () => {
      const bearing = calculateBearing(newYork, london)
      expect(bearing).toBeGreaterThanOrEqual(0)
      expect(bearing).toBeLessThan(360)
    })

    it('calculates due-north bearing as ~0', () => {
      const south = { latitude: 50.0, longitude: 0.0 }
      const north = { latitude: 51.0, longitude: 0.0 }
      const bearing = calculateBearing(south, north)
      expect(bearing).toBeCloseTo(0, 0)
    })

    it('calculates due-east bearing as ~90', () => {
      const west = { latitude: 51.5, longitude: -1.0 }
      const east = { latitude: 51.5, longitude: 1.0 }
      const bearing = calculateBearing(west, east)
      // Great-circle bearing deviates slightly from 90° at non-equatorial latitudes
      expect(bearing).toBeGreaterThan(85)
      expect(bearing).toBeLessThan(95)
    })
  })
})
