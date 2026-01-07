import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import type { AprsPacket } from './aprs-parser'
import { config } from './config'

export interface DbStation {
  id: number
  callsign: string
  latitude: number | null
  longitude: number | null
  symbol: string
  symbol_table: string
  comment: string
  last_heard: number
  packet_count: number
  created_at: number
  updated_at: number
}

export interface DbPacketHistory {
  id: number
  station_id: number
  raw_packet: string
  latitude: number | null
  longitude: number | null
  path: string
  received_at: number
}

let db: Database.Database | null = null

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    callsign TEXT UNIQUE NOT NULL,
    latitude REAL,
    longitude REAL,
    symbol TEXT DEFAULT '-',
    symbol_table TEXT DEFAULT '/',
    comment TEXT DEFAULT '',
    last_heard INTEGER NOT NULL,
    packet_count INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS packet_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    raw_packet TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    path TEXT DEFAULT '',
    received_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_stations_callsign ON stations(callsign);
  CREATE INDEX IF NOT EXISTS idx_stations_last_heard ON stations(last_heard DESC);
  CREATE INDEX IF NOT EXISTS idx_history_station ON packet_history(station_id);
  CREATE INDEX IF NOT EXISTS idx_history_received ON packet_history(received_at DESC);
`

export const initializeDatabase = (path: string = config.database.path): Database.Database => {
  if (db) return db

  // Ensure directory exists
  const dir = dirname(path)
  if (dir && dir !== '.') {
    try {
      mkdirSync(dir, { recursive: true })
    } catch {
      // Directory might already exist
    }
  }

  db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)

  console.log(`[DB] Database initialized at ${path}`)
  return db
}

export const getDatabase = (): Database.Database => {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.')
  }
  return db
}

export const closeDatabase = (): void => {
  if (db) {
    db.close()
    db = null
    console.log('[DB] Database closed')
  }
}

// Upsert station and add to history
export const upsertStation = (packet: AprsPacket): DbStation => {
  const database = getDatabase()
  const now = Date.now()

  const existingStmt = database.prepare('SELECT * FROM stations WHERE callsign = ?')
  const existing = existingStmt.get(packet.source) as DbStation | undefined

  if (existing) {
    // Update existing station
    const updateStmt = database.prepare(`
      UPDATE stations SET
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        symbol = ?,
        symbol_table = ?,
        comment = CASE WHEN ? != '' THEN ? ELSE comment END,
        last_heard = ?,
        packet_count = packet_count + 1,
        updated_at = ?
      WHERE callsign = ?
    `)

    updateStmt.run(
      packet.position?.latitude ?? null,
      packet.position?.longitude ?? null,
      packet.symbol,
      packet.symbolTable,
      packet.comment,
      packet.comment,
      now,
      now,
      packet.source
    )

    // Add to history
    addPacketHistory(existing.id, packet, now)

    return {
      ...existing,
      latitude: packet.position?.latitude ?? existing.latitude,
      longitude: packet.position?.longitude ?? existing.longitude,
      symbol: packet.symbol,
      symbol_table: packet.symbolTable,
      comment: packet.comment || existing.comment,
      last_heard: now,
      packet_count: existing.packet_count + 1,
      updated_at: now,
    }
  }
  // Insert new station
  const insertStmt = database.prepare(`
      INSERT INTO stations (callsign, latitude, longitude, symbol, symbol_table, comment, last_heard, packet_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `)

  insertStmt.run(
    packet.source,
    packet.position?.latitude ?? null,
    packet.position?.longitude ?? null,
    packet.symbol,
    packet.symbolTable,
    packet.comment,
    now,
    now,
    now
  )

  const newStation = existingStmt.get(packet.source) as DbStation | undefined
  if (newStation) {
    addPacketHistory(newStation.id, packet, now)
    return newStation
  }

  // Should never reach here since we just inserted
  throw new Error(`Failed to retrieve newly inserted station: ${packet.source}`)
}

const addPacketHistory = (stationId: number, packet: AprsPacket, receivedAt: number): void => {
  const database = getDatabase()
  const stmt = database.prepare(`
    INSERT INTO packet_history (station_id, raw_packet, latitude, longitude, path, received_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    stationId,
    packet.raw,
    packet.position?.latitude ?? null,
    packet.position?.longitude ?? null,
    packet.path.join(','),
    receivedAt
  )
}

export const getAllStations = (): DbStation[] => {
  const database = getDatabase()
  const stmt = database.prepare('SELECT * FROM stations ORDER BY last_heard DESC')
  return stmt.all() as DbStation[]
}

export const getStationByCallsign = (callsign: string): DbStation | null => {
  const database = getDatabase()
  const stmt = database.prepare('SELECT * FROM stations WHERE callsign = ?')
  return (stmt.get(callsign) as DbStation | undefined) ?? null
}

export const getStationHistory = (stationId: number, limit = 100): DbPacketHistory[] => {
  const database = getDatabase()
  const stmt = database.prepare(
    'SELECT * FROM packet_history WHERE station_id = ? ORDER BY received_at DESC LIMIT ?'
  )
  return stmt.all(stationId, limit) as DbPacketHistory[]
}

export const getStats = (): {
  totalStations: number
  stationsWithPosition: number
  totalPackets: number
} => {
  const database = getDatabase()

  const totalStations =
    (database.prepare('SELECT COUNT(*) as count FROM stations').get() as { count: number })
      ?.count ?? 0

  const stationsWithPosition =
    (
      database
        .prepare(
          'SELECT COUNT(*) as count FROM stations WHERE latitude IS NOT NULL AND longitude IS NOT NULL'
        )
        .get() as { count: number }
    )?.count ?? 0

  const totalPackets =
    (database.prepare('SELECT COUNT(*) as count FROM packet_history').get() as { count: number })
      ?.count ?? 0

  return { totalStations, stationsWithPosition, totalPackets }
}

// Cleanup old history (keep last N days)
export const cleanupOldHistory = (daysToKeep = 7): number => {
  const database = getDatabase()
  const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000
  const stmt = database.prepare('DELETE FROM packet_history WHERE received_at < ?')
  const result = stmt.run(cutoff)
  return result.changes
}
