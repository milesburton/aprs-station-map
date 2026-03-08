import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTER_STATE } from '../../constants'
import type { AprsPacket, Station } from '../../types'
import connectionReducer, {
  resetConnection,
  setConnected,
  setKissConnected,
} from './connectionSlice'
import dataReducer, {
  addPacket,
  clearData,
  setError,
  setLoading,
  setStations,
  setStats,
  updateStation,
} from './dataSlice'
import filterReducer, {
  resetFilters,
  setDirectOnly,
  setHideNoPosition,
  setMaxDistance,
  setRfOnly,
  setSearch,
  setSort,
  setSortBy,
  setSortDirection,
  setStationMaxAge,
  setSymbolFilter,
  setTrailMaxAge,
} from './filterSlice'
import mapReducer, {
  clearSelection,
  followStation,
  selectStation,
  setCentre,
  setMapPosition,
  setZoom,
} from './mapSlice'
import uiReducer, {
  resetUserResize,
  setActiveTab,
  setDiagnosticsHeight,
  setDiagnosticsOpen,
  setSpectrumPoppedOut,
  TAB_HEIGHT_CONSTRAINTS,
  TAB_HEIGHTS,
  toggleDiagnostics,
} from './uiSlice'

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

// ─── connectionSlice ────────────────────────────────────────────────────────

describe('connectionSlice', () => {
  const initial = { connected: false, kissConnected: false }

  it('has correct initial state', () => {
    expect(connectionReducer(undefined, { type: '@@init' })).toEqual(initial)
  })

  it('setConnected sets connected to true', () => {
    const state = connectionReducer(undefined, setConnected(true))
    expect(state.connected).toBe(true)
  })

  it('setConnected sets connected to false', () => {
    const state = connectionReducer({ connected: true, kissConnected: false }, setConnected(false))
    expect(state.connected).toBe(false)
  })

  it('setKissConnected sets kissConnected', () => {
    const state = connectionReducer(undefined, setKissConnected(true))
    expect(state.kissConnected).toBe(true)
  })

  it('resetConnection restores initial state', () => {
    const modified = { connected: true, kissConnected: true }
    expect(connectionReducer(modified, resetConnection())).toEqual(initial)
  })
})

// ─── filterSlice ─────────────────────────────────────────────────────────────

describe('filterSlice', () => {
  it('has correct initial state', () => {
    expect(filterReducer(undefined, { type: '@@init' })).toEqual(DEFAULT_FILTER_STATE)
  })

  it('setSearch updates search term', () => {
    const state = filterReducer(undefined, setSearch('G4'))
    expect(state.search).toBe('G4')
  })

  it('setMaxDistance updates maxDistance', () => {
    const state = filterReducer(undefined, setMaxDistance(100))
    expect(state.maxDistance).toBe(100)
  })

  it('setSymbolFilter sets symbol filter', () => {
    const state = filterReducer(undefined, setSymbolFilter('/'))
    expect(state.symbolFilter).toBe('/')
  })

  it('setSymbolFilter accepts null', () => {
    const state = filterReducer(undefined, setSymbolFilter(null))
    expect(state.symbolFilter).toBeNull()
  })

  it('setHideNoPosition updates flag', () => {
    const state = filterReducer(undefined, setHideNoPosition(true))
    expect(state.hideNoPosition).toBe(true)
  })

  it('setSort updates sortBy and sortDirection together', () => {
    const state = filterReducer(undefined, setSort({ field: 'callsign', direction: 'asc' }))
    expect(state.sortBy).toBe('callsign')
    expect(state.sortDirection).toBe('asc')
  })

  it('setSortBy updates only sortBy', () => {
    const state = filterReducer(undefined, setSortBy('distance'))
    expect(state.sortBy).toBe('distance')
  })

  it('setSortDirection updates only sortDirection', () => {
    const state = filterReducer(undefined, setSortDirection('asc'))
    expect(state.sortDirection).toBe('asc')
  })

  it('setTrailMaxAge updates trailMaxAgeHours', () => {
    const state = filterReducer(undefined, setTrailMaxAge(12))
    expect(state.trailMaxAgeHours).toBe(12)
  })

  it('setStationMaxAge updates stationMaxAgeHours', () => {
    const state = filterReducer(undefined, setStationMaxAge(48))
    expect(state.stationMaxAgeHours).toBe(48)
  })

  it('setRfOnly updates rfOnly', () => {
    const state = filterReducer(undefined, setRfOnly(false))
    expect(state.rfOnly).toBe(false)
  })

  it('setDirectOnly updates directOnly', () => {
    const state = filterReducer(undefined, setDirectOnly(true))
    expect(state.directOnly).toBe(true)
  })

  it('resetFilters restores default filter state', () => {
    const modified = filterReducer(undefined, setSearch('XYZ'))
    expect(filterReducer(modified, resetFilters())).toEqual(DEFAULT_FILTER_STATE)
  })
})

// ─── mapSlice ────────────────────────────────────────────────────────────────

describe('mapSlice', () => {
  it('setCentre updates centre coordinates', () => {
    const state = mapReducer(undefined, setCentre({ latitude: 53.0, longitude: -1.5 }))
    expect(state.centre).toEqual({ latitude: 53.0, longitude: -1.5 })
  })

  it('setZoom updates zoom level', () => {
    const state = mapReducer(undefined, setZoom(12))
    expect(state.zoom).toBe(12)
  })

  it('setMapPosition updates centre and zoom atomically', () => {
    const state = mapReducer(
      undefined,
      setMapPosition({ centre: { latitude: 52.0, longitude: 0.0 }, zoom: 10 })
    )
    expect(state.centre).toEqual({ latitude: 52.0, longitude: 0.0 })
    expect(state.zoom).toBe(10)
  })

  it('selectStation sets selectedStation', () => {
    const state = mapReducer(undefined, selectStation('M0LHA-9'))
    expect(state.selectedStation).toBe('M0LHA-9')
  })

  it('selectStation accepts null to deselect', () => {
    const withSelection = mapReducer(undefined, selectStation('M0LHA-9'))
    const cleared = mapReducer(withSelection, selectStation(null))
    expect(cleared.selectedStation).toBeNull()
  })

  it('followStation sets followedStation', () => {
    const state = mapReducer(undefined, followStation('M0LHA-9'))
    expect(state.followedStation).toBe('M0LHA-9')
  })

  it('clearSelection clears both selectedStation and followedStation', () => {
    const withBoth = {
      ...mapReducer(undefined, { type: '@@init' }),
      selectedStation: 'A',
      followedStation: 'B',
    }
    const state = mapReducer(withBoth, clearSelection())
    expect(state.selectedStation).toBeNull()
    expect(state.followedStation).toBeNull()
  })
})

// ─── uiSlice ─────────────────────────────────────────────────────────────────

describe('uiSlice', () => {
  it('has diagnosticsOpen false initially', () => {
    const state = uiReducer(undefined, { type: '@@init' })
    expect(state.diagnosticsOpen).toBe(false)
  })

  it('toggleDiagnostics opens closed panel', () => {
    const state = uiReducer(undefined, toggleDiagnostics())
    expect(state.diagnosticsOpen).toBe(true)
  })

  it('toggleDiagnostics closes open panel', () => {
    const open = uiReducer(undefined, setDiagnosticsOpen(true))
    expect(uiReducer(open, toggleDiagnostics()).diagnosticsOpen).toBe(false)
  })

  it('setDiagnosticsOpen sets diagnosticsOpen directly', () => {
    const state = uiReducer(undefined, setDiagnosticsOpen(true))
    expect(state.diagnosticsOpen).toBe(true)
  })

  it('setDiagnosticsHeight updates height and marks user-resized', () => {
    const state = uiReducer(undefined, setDiagnosticsHeight(250))
    expect(state.diagnosticsHeight).toBe(250)
    expect(state.userResizedHeight).toBe(true)
  })

  it('setActiveTab changes active tab and uses default height when not user-resized', () => {
    const state = uiReducer(undefined, setActiveTab('packets'))
    expect(state.activeTab).toBe('packets')
    expect(state.diagnosticsHeight).toBe(TAB_HEIGHTS.packets)
  })

  it('setActiveTab clamps height to tab constraints when user has resized', () => {
    const withResize = uiReducer(undefined, setDiagnosticsHeight(500))
    const state = uiReducer(withResize, setActiveTab('status'))
    expect(state.diagnosticsHeight).toBe(TAB_HEIGHT_CONSTRAINTS.status.max)
  })

  it('resetUserResize restores default height and clears flag', () => {
    const resized = uiReducer(undefined, setDiagnosticsHeight(300))
    const state = uiReducer(resized, resetUserResize())
    expect(state.userResizedHeight).toBe(false)
    expect(state.diagnosticsHeight).toBe(TAB_HEIGHTS.stats)
  })

  it('setSpectrumPoppedOut sets the flag', () => {
    const state = uiReducer(undefined, setSpectrumPoppedOut(true))
    expect(state.spectrumPoppedOut).toBe(true)
  })
})

// ─── dataSlice ───────────────────────────────────────────────────────────────

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

  it('setStations deduplicates by callsign, keeping most recent', () => {
    const older = makeStation({ callsign: 'G4ABC', lastHeard: new Date('2024-01-01T10:00:00Z') })
    const newer = makeStation({ callsign: 'G4ABC', lastHeard: new Date('2024-01-01T12:00:00Z') })
    const state = dataReducer(undefined, setStations([older, newer]))
    expect(state.stations).toHaveLength(1)
    expect((state.stations[0] as Station).lastHeard).toEqual(new Date('2024-01-01T12:00:00Z'))
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
    const newStation = makeStation({ callsign: 'M0XYZ' })
    const state = dataReducer(initial, updateStation(newStation))
    expect(state.stations).toHaveLength(2)
    expect((state.stations[0] as Station).callsign).toBe('M0XYZ')
  })

  it('addPacket appends to packets list and station history', () => {
    const packet = makePacket({ source: 'G4ABC' })
    const state = dataReducer(undefined, addPacket(packet))
    expect(state.packets).toHaveLength(1)
    expect(state.stationHistory.G4ABC).toHaveLength(1)
  })

  it('addPacket trims packets to MAX_PACKETS (100)', () => {
    let state = dataReducer(undefined, { type: '@@init' })
    for (let i = 0; i < 105; i++) {
      state = dataReducer(state, addPacket(makePacket({ source: 'G4ABC' })))
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
    const stats = {
      totalStations: 5,
      stationsWithPosition: 3,
      totalPackets: 100,
      kissConnected: false,
    }
    const state = dataReducer(undefined, setStats(stats))
    expect(state.stats).toEqual(stats)
  })

  it('setLoading updates loading flag', () => {
    const state = dataReducer(undefined, setLoading(false))
    expect(state.loading).toBe(false)
  })

  it('setError stores error message', () => {
    const state = dataReducer(undefined, setError('Network error'))
    expect(state.error).toBe('Network error')
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
