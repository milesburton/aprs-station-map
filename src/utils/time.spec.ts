import { describe, expect, test } from 'vitest'
import { formatRelativeTime, parseKmlTimestamp } from './time'

describe('time utilities', () => {
  describe('formatRelativeTime', () => {
    test('formats just now', () => {
      const now = new Date()
      expect(formatRelativeTime(now)).toBe('just now')
    })

    test('formats minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago')
    })

    test('formats hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
      expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago')
    })

    test('formats days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago')
    })
  })

  describe('parseKmlTimestamp', () => {
    test('parses valid ISO timestamp', () => {
      const timestamp = '2024-01-15T10:30:00Z'
      const result = parseKmlTimestamp(timestamp)
      expect(result.toISOString()).toBe('2024-01-15T10:30:00.000Z')
    })

    test('returns current date for undefined', () => {
      const before = Date.now()
      const result = parseKmlTimestamp(undefined)
      const after = Date.now()
      expect(result.getTime()).toBeGreaterThanOrEqual(before)
      expect(result.getTime()).toBeLessThanOrEqual(after)
    })
  })
})
