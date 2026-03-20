import type { DbStation } from './database'

export const makeDbStation = (overrides: Partial<DbStation> = {}): DbStation => ({
  id: 1,
  callsign: 'G4ABC',
  latitude: 51.5,
  longitude: -0.1,
  symbol: '-',
  symbol_table: '/',
  comment: 'Test',
  last_heard: Date.now(),
  packet_count: 1,
  last_path: '',
  created_at: Date.now() - 1000,
  updated_at: Date.now(),
  ...overrides,
})
