import { describe, expect, it } from 'vitest'
import type { AprsPacket, Station, Stats } from '../../types'
import dataReducer, {
  addPacket,
  clearData,
  setError,
  setLoading,
  setStations,
  setStats,
  updateStation,
} from './data-slice'

const makeStation = (overrides: Partial<Station> = {}): Station => ({
  callsign: 'G4ABC',
  coordinates: { latitude: 51.5, longitude: -0.1 },
  symbol: '-',
  symbolTable: '/',
  comment: 'Test',
  lastHeard: new Date('2024-01-01T12:00:00Z'),
  packetCount: 1,
  distance: null,
  bearing: null,
  via: [],
  ...overrides,
})

const makePacket = (overrides: Partial<AprsPacket> = {}): AprsPacket => ({
  raw: 'G4ABC>APRS:test',
  source: 'G4ABC',
  destination: 'APRS',
  path: 'WIDE1-1',
  comment: 'test',
  timestamp: new Date().toISOString(),
  ...overrides,
})

describe('dataSlice', () => {
  it('has correct initial state', () => {
    const state = dataReducer(undefined, { type: '@@init' })
    expect(state.stations).toEqual([])
    expect(state.loading).toBe(true)
    expect(state.error).toBeNull()
    expect(state.stats).toBeNull()
  })

  it('setStations replaces station list and clears loading', () => {
    const state = dataReducer(undefined, setStations([makeStation()]))
    expect(state.stations).toHaveLength(1)
    expect(state.loading).toBe(false)
  })

  it('setStations deduplicates by callsign keeping most recent', () => {
    const older = makeStation({ callsign: 'G4ABC', lastHeard: new Date('2024-01-01T10:00:00Z') })
    const newer = makeStation({ callsign: 'G4ABC', lastHeard: new Date('2024-01-01T12:00:00Z') })
    const state = dataReducer(undefined, setStations([older, newer]))
    expect(state.stations).toHaveLength(1)
    expect((state.stations[0] as Station).lastHeard).toEqual(new Date('2024-01-01T12:00:00Z'))
  })

  it('setStations handles lastHeard as ISO string', () => {
    const a = makeStation({
      callsign: 'G4ABC',
      lastHeard: '2024-01-01T10:00:00Z' as unknown as Date,
    })
    const b = makeStation({
      callsign: 'G4ABC',
      lastHeard: '2024-01-01T12:00:00Z' as unknown as Date,
    })
    const state = dataReducer(undefined, setStations([a, b]))
    expect(state.stations).toHaveLength(1)
  })

  it('updateStation replaces existing station by callsign', () => {
    const initial = dataReducer(undefined, setStations([makeStation({ callsign: 'G4ABC' })]))
    const updated = makeStation({ callsign: 'G4ABC', comment: 'Updated' })
    const state = dataReducer(initial, updateStation(updated))
    expect(state.stations).toHaveLength(1)
    expect((state.stations[0] as Station).comment).toBe('Updated')
  })

  it('updateStation prepends new station when callsign not found', () => {
    const initial = dataReducer(undefined, setStations([makeStation({ callsign: 'G4ABC' })]))
    const state = dataReducer(initial, updateStation(makeStation({ callsign: 'M0XYZ' })))
    expect(state.stations).toHaveLength(2)
    expect((state.stations[0] as Station).callsign).toBe('M0XYZ')
  })

  it('addPacket appends to packets list and station history', () => {
    const state = dataReducer(undefined, addPacket(makePacket({ source: 'G4ABC' })))
    expect(state.packets).toHaveLength(1)
    expect(state.stationHistory.G4ABC).toHaveLength(1)
  })

  it('addPacket trims packets to MAX_PACKETS (100)', () => {
    let state = dataReducer(undefined, { type: '@@init' })
    for (let i = 0; i < 105; i++) {
      state = dataReducer(state, addPacket(makePacket()))
    }
    expect(state.packets).toHaveLength(100)
  })

  it('addPacket trims station history to 50 entries', () => {
    let state = dataReducer(undefined, { type: '@@init' })
    for (let i = 0; i < 55; i++) {
      state = dataReducer(state, addPacket(makePacket({ source: 'G4ABC' })))
    }
    expect(state.stationHistory.G4ABC).toHaveLength(50)
  })

  it('setStats stores stats', () => {
    const stats: Stats = {
      totalStations: 5,
      stationsWithPosition: 3,
      totalPackets: 100,
      kissConnected: false,
    }
    expect(dataReducer(undefined, setStats(stats)).stats).toEqual(stats)
  })

  it('setLoading updates loading flag', () => {
    expect(dataReducer(undefined, setLoading(false)).loading).toBe(false)
  })

  it('setError stores error message', () => {
    expect(dataReducer(undefined, setError('Network error')).error).toBe('Network error')
  })

  it('setError accepts null to clear error', () => {
    const withError = dataReducer(undefined, setError('oops'))
    expect(dataReducer(withError, setError(null)).error).toBeNull()
  })

  it('clearData resets to initial state', () => {
    const withData = dataReducer(undefined, setStations([makeStation()]))
    const cleared = dataReducer(withData, clearData())
    expect(cleared.stations).toEqual([])
    expect(cleared.loading).toBe(true)
  })
})
