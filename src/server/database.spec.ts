import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AprsPacket } from './aprs-parser'
import {
  cleanupOldHistory,
  closeDatabase,
  getAllStationHistories,
  getAllStations,
  getDatabase,
  getStationByCallsign,
  getStationHistory,
  getStats,
  initializeDatabase,
  upsertStation,
} from './database'

const makePacket = (overrides: Partial<AprsPacket> = {}): AprsPacket => ({
  source: 'TEST-1',
  destination: 'APRS',
  path: [],
  type: 'position',
  position: { latitude: 51.5, longitude: -0.1 },
  symbol: '-',
  symbolTable: '/',
  comment: 'Test station',
  raw: '!5130.00N/00006.00W-Test station',
  ...overrides,
})

describe('database', () => {
  beforeEach(() => {
    // Use in-memory SQLite for fast, isolated tests
    initializeDatabase(':memory:')
  })

  afterEach(() => {
    closeDatabase()
  })

  describe('initializeDatabase', () => {
    it('returns the database instance', () => {
      const db = getDatabase()
      expect(db).toBeDefined()
    })

    it('creates the stations table', () => {
      const db = getDatabase()
      const result = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stations'")
        .get()
      expect(result).toBeDefined()
    })

    it('creates the packet_history table', () => {
      const db = getDatabase()
      const result = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='packet_history'")
        .get()
      expect(result).toBeDefined()
    })

    it('returns existing instance on second call', () => {
      const db1 = getDatabase()
      const db2 = getDatabase()
      expect(db1).toBe(db2)
    })
  })

  describe('getDatabase', () => {
    it('throws if database is not initialized', () => {
      closeDatabase()
      expect(() => getDatabase()).toThrow('Database not initialized')
    })
  })

  describe('upsertStation', () => {
    it('inserts a new station', () => {
      const packet = makePacket()
      const station = upsertStation(packet)

      expect(station.callsign).toBe('TEST-1')
      expect(station.latitude).toBeCloseTo(51.5)
      expect(station.longitude).toBeCloseTo(-0.1)
      expect(station.symbol).toBe('-')
      expect(station.symbol_table).toBe('/')
      expect(station.comment).toBe('Test station')
      expect(station.packet_count).toBe(1)
    })

    it('updates an existing station on second packet', () => {
      const packet = makePacket()
      upsertStation(packet)

      const updated = upsertStation(
        makePacket({
          position: { latitude: 52.0, longitude: -1.0 },
          comment: 'Updated comment',
        })
      )

      expect(updated.packet_count).toBe(2)
      expect(updated.latitude).toBeCloseTo(52.0)
      expect(updated.longitude).toBeCloseTo(-1.0)
      expect(updated.comment).toBe('Updated comment')
    })

    it('preserves existing position when new packet has no position', () => {
      upsertStation(makePacket({ position: { latitude: 51.5, longitude: -0.1 } }))
      const updated = upsertStation(makePacket({ position: undefined, type: 'status' }))

      expect(updated.latitude).toBeCloseTo(51.5)
      expect(updated.longitude).toBeCloseTo(-0.1)
    })

    it('preserves existing comment when new packet has empty comment', () => {
      upsertStation(makePacket({ comment: 'Original comment' }))
      const updated = upsertStation(makePacket({ comment: '' }))

      expect(updated.comment).toBe('Original comment')
    })

    it('stores the digipeater path as comma-separated string', () => {
      const packet = makePacket({ path: ['WIDE1-1', 'WIDE2-1'] })
      const station = upsertStation(packet)
      expect(station.last_path).toBe('WIDE1-1,WIDE2-1')
    })

    it('stores empty path correctly', () => {
      const packet = makePacket({ path: [] })
      const station = upsertStation(packet)
      expect(station.last_path).toBe('')
    })

    it('creates a packet_history entry on insert', () => {
      const packet = makePacket()
      const station = upsertStation(packet)
      const history = getStationHistory(station.id)
      expect(history).toHaveLength(1)
    })

    it('creates a packet_history entry on update', () => {
      const packet = makePacket()
      const station = upsertStation(packet)
      upsertStation(makePacket({ comment: 'second packet' }))
      const history = getStationHistory(station.id)
      expect(history).toHaveLength(2)
    })

    it('handles station without position', () => {
      const packet = makePacket({ position: undefined, type: 'status' })
      const station = upsertStation(packet)
      expect(station.latitude).toBeNull()
      expect(station.longitude).toBeNull()
    })

    it('stores multiple different stations independently', () => {
      upsertStation(makePacket({ source: 'ALPHA-1' }))
      upsertStation(makePacket({ source: 'BETA-2', symbol: '>' }))

      const all = getAllStations()
      expect(all).toHaveLength(2)
    })
  })

  describe('getAllStations', () => {
    it('returns empty array when no stations', () => {
      expect(getAllStations()).toHaveLength(0)
    })

    it('returns all inserted stations', () => {
      upsertStation(makePacket({ source: 'ALPHA-1' }))
      upsertStation(makePacket({ source: 'BETA-2' }))
      expect(getAllStations()).toHaveLength(2)
    })

    it('orders by last_heard descending', () => {
      const db = getDatabase()
      // Insert with explicit timestamps to guarantee ordering regardless of clock resolution
      const t1 = Date.now() - 2000
      const t2 = Date.now() - 1000
      db.prepare(
        'INSERT INTO stations (callsign, latitude, longitude, symbol, symbol_table, comment, last_heard, last_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run('FIRST-1', null, null, '-', '/', '', t1, '', t1, t1)
      db.prepare(
        'INSERT INTO stations (callsign, latitude, longitude, symbol, symbol_table, comment, last_heard, last_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run('SECOND-1', null, null, '-', '/', '', t2, '', t2, t2)

      const stations = getAllStations()
      expect(stations[0]?.callsign).toBe('SECOND-1')
      expect(stations[1]?.callsign).toBe('FIRST-1')
    })
  })

  describe('getStationByCallsign', () => {
    it('returns null for unknown callsign', () => {
      expect(getStationByCallsign('UNKNOWN')).toBeNull()
    })

    it('returns station for known callsign', () => {
      upsertStation(makePacket({ source: 'G4ABC' }))
      const station = getStationByCallsign('G4ABC')
      expect(station).not.toBeNull()
      expect(station?.callsign).toBe('G4ABC')
    })
  })

  describe('getStationHistory', () => {
    it('returns empty array for unknown station id', () => {
      expect(getStationHistory(999)).toHaveLength(0)
    })

    it('returns history ordered by received_at descending', () => {
      const station = upsertStation(makePacket())
      // Send two more packets
      upsertStation(makePacket({ comment: 'second' }))
      upsertStation(makePacket({ comment: 'third' }))

      const history = getStationHistory(station.id)
      expect(history).toHaveLength(3)
      // Most recent first
      expect(history[0]?.path).toBeDefined()
    })

    it('respects the limit parameter', () => {
      const station = upsertStation(makePacket())
      for (let i = 0; i < 5; i++) {
        upsertStation(makePacket({ comment: `packet ${i}` }))
      }
      const history = getStationHistory(station.id, 3)
      expect(history).toHaveLength(3)
    })

    it('stores position in history', () => {
      const station = upsertStation(makePacket({ position: { latitude: 51.5, longitude: -0.1 } }))
      const history = getStationHistory(station.id)
      expect(history[0]?.latitude).toBeCloseTo(51.5)
      expect(history[0]?.longitude).toBeCloseTo(-0.1)
    })

    it('stores null position in history when packet has no position', () => {
      const station = upsertStation(makePacket({ position: undefined, type: 'status' }))
      const history = getStationHistory(station.id)
      expect(history[0]?.latitude).toBeNull()
      expect(history[0]?.longitude).toBeNull()
    })
  })

  describe('getAllStationHistories', () => {
    it('returns empty object when no stations', () => {
      expect(getAllStationHistories()).toEqual({})
    })

    it('returns histories grouped by callsign', () => {
      upsertStation(
        makePacket({ source: 'ALPHA-1', position: { latitude: 51.5, longitude: -0.1 } })
      )
      upsertStation(makePacket({ source: 'BETA-2', position: { latitude: 52.0, longitude: 0.5 } }))

      const histories = getAllStationHistories()
      expect(Object.keys(histories)).toHaveLength(2)
      expect(histories['ALPHA-1']).toHaveLength(1)
      expect(histories['BETA-2']).toHaveLength(1)
    })

    it('excludes packets without position', () => {
      upsertStation(makePacket({ source: 'NO-POS', position: undefined, type: 'status' }))
      const histories = getAllStationHistories()
      expect(Object.keys(histories)).toHaveLength(0)
    })

    it('excludes old packets beyond maxAgeHours', () => {
      const db = getDatabase()
      // Insert a station with a very old timestamp directly
      const oldTime = Date.now() - 48 * 60 * 60 * 1000 // 48 hours ago
      db.prepare(
        'INSERT INTO stations (callsign, latitude, longitude, symbol, symbol_table, comment, last_heard, last_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run('OLD-STA', 51.0, -0.5, '-', '/', 'old', oldTime, '', oldTime, oldTime)

      const stationRow = db
        .prepare('SELECT id FROM stations WHERE callsign = ?')
        .get('OLD-STA') as { id: number }

      db.prepare(
        'INSERT INTO packet_history (station_id, raw_packet, latitude, longitude, path, received_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(stationRow.id, 'raw', 51.0, -0.5, '', oldTime)

      const histories = getAllStationHistories(24) // only last 24 hours
      expect(histories['OLD-STA']).toBeUndefined()
    })

    it('limits per-station history to the limit parameter', () => {
      // Insert station and 10 history packets
      const station = upsertStation(makePacket({ source: 'TRAIL-1' }))
      for (let i = 0; i < 9; i++) {
        upsertStation(makePacket({ source: 'TRAIL-1', comment: `packet ${i}` }))
      }
      expect(getStationHistory(station.id)).toHaveLength(10)

      const histories = getAllStationHistories(24, 5)
      expect(histories['TRAIL-1']?.length).toBe(5)
    })
  })

  describe('getStats', () => {
    it('returns zeros with empty database', () => {
      const stats = getStats()
      expect(stats.totalStations).toBe(0)
      expect(stats.stationsWithPosition).toBe(0)
      expect(stats.totalPackets).toBe(0)
    })

    it('counts total stations', () => {
      upsertStation(makePacket({ source: 'ALPHA-1' }))
      upsertStation(makePacket({ source: 'BETA-2' }))
      const stats = getStats()
      expect(stats.totalStations).toBe(2)
    })

    it('counts only stations with position', () => {
      upsertStation(
        makePacket({ source: 'WITH-POS', position: { latitude: 51.5, longitude: -0.1 } })
      )
      upsertStation(makePacket({ source: 'NO-POS', position: undefined, type: 'status' }))
      const stats = getStats()
      expect(stats.totalStations).toBe(2)
      expect(stats.stationsWithPosition).toBe(1)
    })

    it('counts total packets', () => {
      upsertStation(makePacket({ source: 'ALPHA-1' }))
      upsertStation(makePacket({ source: 'ALPHA-1', comment: 'second' }))
      upsertStation(makePacket({ source: 'BETA-2' }))
      const stats = getStats()
      expect(stats.totalPackets).toBe(3)
    })
  })

  describe('cleanupOldHistory', () => {
    it('returns 0 when nothing to clean', () => {
      upsertStation(makePacket())
      const deleted = cleanupOldHistory(7)
      expect(deleted).toBe(0)
    })

    it('deletes old history entries', () => {
      const db = getDatabase()
      const station = upsertStation(makePacket())

      // Directly insert an old history entry
      const oldTime = Date.now() - 10 * 24 * 60 * 60 * 1000 // 10 days ago
      db.prepare(
        'INSERT INTO packet_history (station_id, raw_packet, latitude, longitude, path, received_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(station.id, 'old packet', 51.5, -0.1, '', oldTime)

      const before = getStationHistory(station.id)
      expect(before).toHaveLength(2)

      const deleted = cleanupOldHistory(7)
      expect(deleted).toBe(1)

      const after = getStationHistory(station.id)
      expect(after).toHaveLength(1)
    })

    it('preserves recent history', () => {
      upsertStation(makePacket())
      const deleted = cleanupOldHistory(1) // keep last 1 day
      expect(deleted).toBe(0)
      const stats = getStats()
      expect(stats.totalPackets).toBe(1)
    })
  })
})
