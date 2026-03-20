import { describe, expect, it } from 'vitest'
import { calculateBearing, calculateDistance } from './geo'

const london = { latitude: 51.5074, longitude: -0.1278 }
const paris = { latitude: 48.8566, longitude: 2.3522 }
const newYork = { latitude: 40.7128, longitude: -74.006 }

describe('calculateDistance', () => {
  it('London → Paris is ~344 km', () => {
    const d = calculateDistance(london, paris)
    expect(d).toBeGreaterThan(340)
    expect(d).toBeLessThan(350)
  })

  it('London → New York is ~5570 km', () => {
    const d = calculateDistance(london, newYork)
    expect(d).toBeGreaterThan(5550)
    expect(d).toBeLessThan(5600)
  })

  it('returns 0 for identical points', () => {
    expect(calculateDistance(london, london)).toBe(0)
  })

  it('is symmetric (A→B ≈ B→A)', () => {
    expect(calculateDistance(london, paris)).toBeCloseTo(calculateDistance(paris, london), 5)
  })
})

describe('calculateBearing', () => {
  it('London → Paris is roughly SE (~150°)', () => {
    const b = calculateBearing(london, paris)
    expect(b).toBeGreaterThan(140)
    expect(b).toBeLessThan(160)
  })

  it('London → New York is roughly W (~290°)', () => {
    const b = calculateBearing(london, newYork)
    expect(b).toBeGreaterThan(280)
    expect(b).toBeLessThan(300)
  })

  it('returns a value in [0, 360)', () => {
    const b = calculateBearing(newYork, london)
    expect(b).toBeGreaterThanOrEqual(0)
    expect(b).toBeLessThan(360)
  })

  it('due north is ~0°', () => {
    expect(
      calculateBearing({ latitude: 50, longitude: 0 }, { latitude: 51, longitude: 0 })
    ).toBeCloseTo(0, 0)
  })

  it('due east is ~90°', () => {
    const b = calculateBearing({ latitude: 51.5, longitude: -1 }, { latitude: 51.5, longitude: 1 })
    expect(b).toBeGreaterThan(85)
    expect(b).toBeLessThan(95)
  })
})
