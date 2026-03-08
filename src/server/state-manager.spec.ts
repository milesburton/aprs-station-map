import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DbStation } from './database'
import { stateManager } from './state-manager'

const makeDbStation = (overrides: Partial<DbStation> = {}): DbStation => ({
  id: 1,
  callsign: 'TEST-1',
  latitude: 51.5,
  longitude: -0.1,
  symbol: '-',
  symbol_table: '/',
  comment: 'Test',
  last_heard: Date.now(),
  created_at: Date.now() - 1000,
  updated_at: Date.now(),
  packet_count: 1,
  last_path: '',
  ...overrides,
})

describe('StateManager', () => {
  beforeEach(() => {
    stateManager.removeAllListeners()
  })

  describe('isKissConnected', () => {
    it('returns false initially', () => {
      expect(stateManager.isKissConnected()).toBe(false)
    })

    it('returns true after emitKissConnected', () => {
      stateManager.emitKissConnected()
      expect(stateManager.isKissConnected()).toBe(true)
    })

    it('returns false after emitKissDisconnected', () => {
      stateManager.emitKissConnected()
      stateManager.emitKissDisconnected()
      expect(stateManager.isKissConnected()).toBe(false)
    })
  })

  describe('emitStationUpdate', () => {
    it('emits state event with station_update type', () => {
      const listener = vi.fn()
      stateManager.on('state', listener)
      const station = makeDbStation()
      stateManager.emitStationUpdate(station, true)
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'station_update', station, isNew: true })
      )
    })

    it('passes isNew=false for existing stations', () => {
      const listener = vi.fn()
      stateManager.on('state', listener)
      stateManager.emitStationUpdate(makeDbStation(), false)
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ isNew: false }))
    })
  })

  describe('emitStatsUpdate', () => {
    it('emits state event with stats_update type', () => {
      const listener = vi.fn()
      stateManager.on('state', listener)
      const stats = { totalStations: 5, stationsWithPosition: 3, totalPackets: 100 }
      stateManager.emitStatsUpdate(stats)
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'stats_update', stats })
      )
    })
  })

  describe('emitKissConnected', () => {
    it('emits state event with kiss_connected type', () => {
      const listener = vi.fn()
      stateManager.on('state', listener)
      stateManager.emitKissConnected()
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'kiss_connected' }))
    })
  })

  describe('emitKissDisconnected', () => {
    it('emits state event with kiss_disconnected type', () => {
      const listener = vi.fn()
      stateManager.on('state', listener)
      stateManager.emitKissDisconnected()
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'kiss_disconnected' }))
    })
  })

  describe('emitAprsPacket', () => {
    it('emits state event with aprs_packet type', () => {
      const listener = vi.fn()
      stateManager.on('state', listener)
      const packet = {
        raw: 'M0ABC>APRS:>test',
        source: 'M0ABC',
        destination: 'APRS',
        path: 'WIDE1-1',
        comment: 'test',
        timestamp: new Date().toISOString(),
      }
      stateManager.emitAprsPacket(packet)
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'aprs_packet', packet })
      )
    })
  })
})
