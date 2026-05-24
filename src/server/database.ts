import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import type { ParsedAisMessage } from './ais-parser'
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
  last_path: string
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

export interface DbVessel {
  id: number
  mmsi: string
  callsign: string | null
  ship_name: string | null
  latitude: number | null
  longitude: number | null
  course: number | null
  speed: number | null
  heading: number | null
  ship_type: number | null
  last_heard: number
  packet_count: number
  created_at: number
  updated_at: number
}

let db: Database.Database | null = null

// In-process counters. Primed once from the DB at startup, then maintained
// incrementally on every insert/update/delete. Avoids COUNT(*) on hot paths,
// which on large packet_history tables blocks the Node event loop for seconds.
const counters = {
  primed: false,
  totalStations: 0,
  stationsWithPosition: 0,
  totalPackets: 0,
  totalVessels: 0,
  vesselsWithPosition: 0,
}

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
    last_path TEXT DEFAULT '',
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

  CREATE TABLE IF NOT EXISTS vessels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mmsi TEXT UNIQUE NOT NULL,
    callsign TEXT,
    ship_name TEXT,
    latitude REAL,
    longitude REAL,
    course REAL,
    speed REAL,
    heading INTEGER,
    ship_type INTEGER,
    last_heard INTEGER NOT NULL,
    packet_count INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_stations_callsign ON stations(callsign);
  CREATE INDEX IF NOT EXISTS idx_stations_last_heard ON stations(last_heard DESC);
  CREATE INDEX IF NOT EXISTS idx_history_station ON packet_history(station_id);
  CREATE INDEX IF NOT EXISTS idx_history_received ON packet_history(received_at DESC);
  CREATE INDEX IF NOT EXISTS idx_vessels_mmsi ON vessels(mmsi);
  CREATE INDEX IF NOT EXISTS idx_vessels_last_heard ON vessels(last_heard DESC);
`

export const initializeDatabase = (path: string = config.database.path): Database.Database => {
  if (db) return db

  const dir = dirname(path)
  if (dir && dir !== '.') {
    try {
      mkdirSync(dir, { recursive: true })
    } catch {
      // already exists
    }
  }

  db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)

  try {
    db.exec('ALTER TABLE stations ADD COLUMN last_path TEXT DEFAULT ""')
    console.log('[DB] Added last_path column')
  } catch {
    // column already exists — no-op
  }

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
  counters.primed = false
  counters.totalStations = 0
  counters.stationsWithPosition = 0
  counters.totalPackets = 0
  counters.totalVessels = 0
  counters.vesselsWithPosition = 0
}

export const upsertStation = (packet: AprsPacket): DbStation => {
  const database = getDatabase()
  const now = Date.now()

  const existingStmt = database.prepare('SELECT * FROM stations WHERE callsign = ?')
  const existing = existingStmt.get(packet.source) as DbStation | undefined

  const pathStr = packet.path.join(',')

  if (existing) {
    const updateStmt = database.prepare(`
      UPDATE stations SET
        latitude = CASE WHEN ? IS NOT NULL THEN ? ELSE latitude END,
        longitude = CASE WHEN ? IS NOT NULL THEN ? ELSE longitude END,
        symbol = ?,
        symbol_table = ?,
        comment = CASE WHEN ? != '' THEN ? ELSE comment END,
        last_heard = ?,
        packet_count = packet_count + 1,
        last_path = ?,
        updated_at = ?
      WHERE callsign = ?
    `)

    updateStmt.run(
      packet.position?.latitude ?? null,
      packet.position?.latitude ?? null,
      packet.position?.longitude ?? null,
      packet.position?.longitude ?? null,
      packet.symbol,
      packet.symbolTable,
      packet.comment,
      packet.comment,
      now,
      pathStr,
      now,
      packet.source
    )

    trackStationPositionGained(existing, packet)
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
      last_path: pathStr,
      updated_at: now,
    }
  }
  const insertStmt = database.prepare(`
      INSERT INTO stations (callsign, latitude, longitude, symbol, symbol_table, comment, last_heard, packet_count, last_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `)

  insertStmt.run(
    packet.source,
    packet.position?.latitude ?? null,
    packet.position?.longitude ?? null,
    packet.symbol,
    packet.symbolTable,
    packet.comment,
    now,
    pathStr,
    now,
    now
  )

  counters.totalStations += 1
  if (packet.position?.latitude != null && packet.position?.longitude != null) {
    counters.stationsWithPosition += 1
  }

  const newStation = existingStmt.get(packet.source) as DbStation | undefined
  if (newStation) {
    addPacketHistory(newStation.id, packet, now)
    return newStation
  }

  throw new Error(`Failed to retrieve newly inserted station: ${packet.source}`)
}

const trackStationPositionGained = (existing: DbStation, packet: AprsPacket): void => {
  if (existing.latitude !== null || existing.longitude !== null) return
  if (packet.position?.latitude == null || packet.position?.longitude == null) return
  counters.stationsWithPosition += 1
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

  counters.totalPackets += 1
}

export const getAllStations = (limit?: number): DbStation[] => {
  const database = getDatabase()
  const query = limit
    ? 'SELECT * FROM stations ORDER BY last_heard DESC LIMIT ?'
    : 'SELECT * FROM stations ORDER BY last_heard DESC'
  const stmt = database.prepare(query)
  return (limit ? stmt.all(limit) : stmt.all()) as DbStation[]
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

export const getAllStationHistories = (
  maxAgeHours = 24,
  limit = 50,
  maxStations?: number
): Record<string, DbPacketHistory[]> => {
  const database = getDatabase()
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000

  const stmt = database.prepare(`
    SELECT s.id, s.callsign, ph.id as packet_id, ph.raw_packet, ph.latitude, ph.longitude, ph.path, ph.received_at
    FROM stations s
    INNER JOIN packet_history ph ON s.id = ph.station_id
    WHERE ph.latitude IS NOT NULL
      AND ph.longitude IS NOT NULL
      AND ph.received_at > ?
    ORDER BY ph.received_at DESC
  `)

  const rows = stmt.all(cutoff) as Array<{
    id: number
    callsign: string
    packet_id: number
    raw_packet: string
    latitude: number
    longitude: number
    path: string
    received_at: number
  }>

  const result: Record<string, DbPacketHistory[]> = {}
  let stationCount = 0
  for (const row of rows) {
    if (!result[row.callsign]) {
      if (maxStations && stationCount >= maxStations) {
        continue
      }
      result[row.callsign] = []
      stationCount += 1
    }
    if ((result[row.callsign]?.length ?? 0) < limit) {
      result[row.callsign]?.push({
        id: row.packet_id,
        station_id: row.id,
        raw_packet: row.raw_packet,
        latitude: row.latitude,
        longitude: row.longitude,
        path: row.path,
        received_at: row.received_at,
      })
    }
  }

  return result
}

const primeCounters = (): void => {
  if (counters.primed) return
  const database = getDatabase()
  counters.totalStations =
    (database.prepare('SELECT COUNT(*) as count FROM stations').get() as { count: number })
      ?.count ?? 0
  counters.stationsWithPosition =
    (
      database
        .prepare(
          'SELECT COUNT(*) as count FROM stations WHERE latitude IS NOT NULL AND longitude IS NOT NULL'
        )
        .get() as { count: number }
    )?.count ?? 0
  counters.totalPackets =
    (database.prepare('SELECT COUNT(*) as count FROM packet_history').get() as { count: number })
      ?.count ?? 0
  counters.totalVessels =
    (database.prepare('SELECT COUNT(*) as count FROM vessels').get() as { count: number })?.count ??
    0
  counters.vesselsWithPosition =
    (
      database
        .prepare(
          'SELECT COUNT(*) as count FROM vessels WHERE latitude IS NOT NULL AND longitude IS NOT NULL'
        )
        .get() as { count: number }
    )?.count ?? 0
  counters.primed = true
}

export const getStats = (): {
  totalStations: number
  stationsWithPosition: number
  totalPackets: number
  totalVessels: number
  vesselsWithPosition: number
} => {
  if (!counters.primed) primeCounters()
  return {
    totalStations: counters.totalStations,
    stationsWithPosition: counters.stationsWithPosition,
    totalPackets: counters.totalPackets,
    totalVessels: counters.totalVessels,
    vesselsWithPosition: counters.vesselsWithPosition,
  }
}

export const cleanupOldHistory = (daysToKeep = 7): number => {
  const database = getDatabase()
  const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000
  const stmt = database.prepare('DELETE FROM packet_history WHERE received_at < ?')
  const result = stmt.run(cutoff)
  counters.totalPackets = Math.max(0, counters.totalPackets - result.changes)
  return result.changes
}

const hasValidPosition = (aisMsg: ParsedAisMessage): boolean =>
  aisMsg.latitude !== 0 && aisMsg.longitude !== 0

const updateExistingVessel = (
  database: Database.Database,
  aisMsg: ParsedAisMessage,
  existing: DbVessel,
  now: number
): DbVessel => {
  const updateStmt = database.prepare(`
    UPDATE vessels SET
      callsign = COALESCE(?, callsign),
      ship_name = COALESCE(?, ship_name),
      latitude = COALESCE(?, latitude),
      longitude = COALESCE(?, longitude),
      course = COALESCE(?, course),
      speed = COALESCE(?, speed),
      heading = COALESCE(?, heading),
      ship_type = COALESCE(?, ship_type),
      last_heard = ?,
      packet_count = packet_count + 1,
      updated_at = ?
    WHERE mmsi = ?
  `)

  updateStmt.run(
    aisMsg.callsign ?? null,
    aisMsg.shipName ?? null,
    aisMsg.latitude,
    aisMsg.longitude,
    aisMsg.course ?? null,
    aisMsg.speed ?? null,
    aisMsg.heading ?? null,
    aisMsg.shipType ?? null,
    now,
    now,
    aisMsg.mmsi
  )

  return {
    ...existing,
    callsign: aisMsg.callsign ?? existing.callsign,
    ship_name: aisMsg.shipName ?? existing.ship_name,
    latitude: aisMsg.latitude,
    longitude: aisMsg.longitude,
    course: aisMsg.course ?? existing.course,
    speed: aisMsg.speed ?? existing.speed,
    heading: aisMsg.heading ?? existing.heading,
    ship_type: aisMsg.shipType ?? existing.ship_type,
    last_heard: now,
    packet_count: existing.packet_count + 1,
    updated_at: now,
  }
}

const insertNewVessel = (
  database: Database.Database,
  aisMsg: ParsedAisMessage,
  now: number
): DbVessel | null => {
  const insertStmt = database.prepare(`
    INSERT INTO vessels (mmsi, callsign, ship_name, latitude, longitude, course, speed, heading, ship_type, last_heard, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insertStmt.run(
    aisMsg.mmsi,
    aisMsg.callsign ?? null,
    aisMsg.shipName ?? null,
    aisMsg.latitude,
    aisMsg.longitude,
    aisMsg.course ?? null,
    aisMsg.speed ?? null,
    aisMsg.heading ?? null,
    aisMsg.shipType ?? null,
    now,
    now,
    now
  )

  const newVessel = database.prepare('SELECT * FROM vessels WHERE mmsi = ?').get(aisMsg.mmsi) as
    | DbVessel
    | undefined

  if (!newVessel) return null
  counters.totalVessels += 1
  counters.vesselsWithPosition += 1
  return newVessel
}

export const upsertVessel = (aisMsg: ParsedAisMessage): DbVessel => {
  const database = getDatabase()
  const now = Date.now()
  const existing = database.prepare('SELECT * FROM vessels WHERE mmsi = ?').get(aisMsg.mmsi) as
    | DbVessel
    | undefined

  const hasPosition = hasValidPosition(aisMsg)

  if (existing && hasPosition) {
    return updateExistingVessel(database, aisMsg, existing, now)
  }

  if (hasPosition) {
    const inserted = insertNewVessel(database, aisMsg, now)
    if (inserted) return inserted
  }

  if (existing) return existing

  throw new Error(`Failed to insert or retrieve vessel: ${aisMsg.mmsi}`)
}

export const getAllVessels = (): DbVessel[] => {
  const database = getDatabase()
  const stmt = database.prepare('SELECT * FROM vessels ORDER BY last_heard DESC')
  return stmt.all() as DbVessel[]
}

export const getVesselByMmsi = (mmsi: string): DbVessel | null => {
  const database = getDatabase()
  const stmt = database.prepare('SELECT * FROM vessels WHERE mmsi = ?')
  return (stmt.get(mmsi) as DbVessel | undefined) ?? null
}
