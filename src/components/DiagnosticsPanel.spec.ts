import { describe, expect, test } from 'vitest'
import type { Stats } from '../types'

// Extract the logic functions for testing
const getStatusIndicator = (connected: boolean, stats: Stats | null): string => {
  if (!connected) return '🔴'
  if (stats !== null && !stats.kissConnected) return '🟡'
  return '🟢'
}

const getStatusText = (connected: boolean, stats: Stats | null, packetsLength: number): string => {
  if (!connected) return 'WebSocket Disconnected'
  if (stats !== null && !stats.kissConnected) return 'KISS TNC Disconnected'
  if (stats === null) return 'Connecting...'
  if (packetsLength === 0) return 'Ready - Awaiting Packets'
  return `Receiving Packets (${packetsLength} total)`
}

const shouldShowKissHelp = (stats: Stats | null): boolean => {
  return stats !== null && !stats.kissConnected
}

const shouldShowAwaitingInfo = (stats: Stats | null, packetsLength: number): boolean => {
  return stats?.kissConnected === true && packetsLength === 0
}

describe('DiagnosticsPanel status logic', () => {
  const connectedStats: Stats = {
    kissConnected: true,
    totalStations: 10,
    stationsWithPosition: 8,
    totalPackets: 50,
  }

  const disconnectedStats: Stats = {
    kissConnected: false,
    totalStations: 0,
    stationsWithPosition: 0,
    totalPackets: 0,
  }

  describe('getStatusIndicator', () => {
    test('returns red when WebSocket disconnected', () => {
      expect(getStatusIndicator(false, null)).toBe('🔴')
      expect(getStatusIndicator(false, connectedStats)).toBe('🔴')
    })

    test('returns yellow when KISS TNC disconnected', () => {
      expect(getStatusIndicator(true, disconnectedStats)).toBe('🟡')
    })

    test('returns green when connected and stats is null (connecting)', () => {
      expect(getStatusIndicator(true, null)).toBe('🟢')
    })

    test('returns green when fully connected', () => {
      expect(getStatusIndicator(true, connectedStats)).toBe('🟢')
    })
  })

  describe('getStatusText', () => {
    test('shows WebSocket Disconnected when not connected', () => {
      expect(getStatusText(false, null, 0)).toBe('WebSocket Disconnected')
      expect(getStatusText(false, connectedStats, 5)).toBe('WebSocket Disconnected')
    })

    test('shows KISS TNC Disconnected when stats shows not connected', () => {
      expect(getStatusText(true, disconnectedStats, 0)).toBe('KISS TNC Disconnected')
    })

    test('shows Connecting when connected but stats is null', () => {
      expect(getStatusText(true, null, 0)).toBe('Connecting...')
    })

    test('shows Ready - Awaiting Packets when connected with no packets', () => {
      expect(getStatusText(true, connectedStats, 0)).toBe('Ready - Awaiting Packets')
    })

    test('shows packet count when receiving packets', () => {
      expect(getStatusText(true, connectedStats, 5)).toBe('Receiving Packets (5 total)')
      expect(getStatusText(true, connectedStats, 100)).toBe('Receiving Packets (100 total)')
    })
  })

  describe('shouldShowKissHelp', () => {
    test('returns false when stats is null', () => {
      expect(shouldShowKissHelp(null)).toBe(false)
    })

    test('returns true when stats exists and KISS not connected', () => {
      expect(shouldShowKissHelp(disconnectedStats)).toBe(true)
    })

    test('returns false when KISS is connected', () => {
      expect(shouldShowKissHelp(connectedStats)).toBe(false)
    })
  })

  describe('shouldShowAwaitingInfo', () => {
    test('returns false when stats is null', () => {
      expect(shouldShowAwaitingInfo(null, 0)).toBe(false)
    })

    test('returns false when KISS not connected', () => {
      expect(shouldShowAwaitingInfo(disconnectedStats, 0)).toBe(false)
    })

    test('returns true when KISS connected and no packets', () => {
      expect(shouldShowAwaitingInfo(connectedStats, 0)).toBe(true)
    })

    test('returns false when KISS connected and has packets', () => {
      expect(shouldShowAwaitingInfo(connectedStats, 5)).toBe(false)
    })
  })
})
