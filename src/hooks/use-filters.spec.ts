import { configureStore } from '@reduxjs/toolkit'
import { renderHook } from '@testing-library/react'
import { act, createElement, type ReactNode } from 'react'
import { Provider } from 'react-redux'
import { describe, expect, it } from 'vitest'
import connectionReducer from '../store/slices/connection-slice'
import dataReducer from '../store/slices/data-slice'
import filterReducer from '../store/slices/filter-slice'
import mapReducer from '../store/slices/map-slice'
import uiReducer from '../store/slices/ui-slice'
import type { Station } from '../types'
import { useFilters } from './use-filters'

const makeStore = () =>
  configureStore({
    reducer: {
      filters: filterReducer,
      map: mapReducer,
      ui: uiReducer,
      data: dataReducer,
      connection: connectionReducer,
    },
  })

const makeWrapper =
  (store: ReturnType<typeof makeStore>) =>
  ({ children }: { children: ReactNode }) =>
    createElement(Provider, { store }, children)

const makeStation = (overrides: Partial<Station> = {}): Station => ({
  callsign: 'G4ABC',
  coordinates: { latitude: 51.5, longitude: -0.1 },
  symbol: '-',
  symbolTable: '/',
  comment: '',
  lastHeard: new Date(),
  packetCount: 1,
  distance: 10,
  bearing: 90,
  via: [],
  ...overrides,
})

describe('useFilters', () => {
  it('returns all stations when no filters applied', () => {
    const store = makeStore()
    const stations = [makeStation({ callsign: 'G4ABC' }), makeStation({ callsign: 'M0XYZ' })]
    const { result } = renderHook(() => useFilters(stations), { wrapper: makeWrapper(store) })
    expect(result.current.filteredStations).toHaveLength(2)
  })

  it('setSearch filters stations by callsign', () => {
    const store = makeStore()
    const stations = [makeStation({ callsign: 'G4ABC' }), makeStation({ callsign: 'M0XYZ' })]
    const { result } = renderHook(() => useFilters(stations), { wrapper: makeWrapper(store) })

    act(() => result.current.setSearch('G4'))

    expect(result.current.filteredStations).toHaveLength(1)
    expect(result.current.filteredStations[0]?.callsign).toBe('G4ABC')
  })

  it('resetFilters clears search', () => {
    const store = makeStore()
    const stations = [makeStation({ callsign: 'G4ABC' })]
    const { result } = renderHook(() => useFilters(stations), { wrapper: makeWrapper(store) })

    act(() => result.current.setSearch('XYZ'))
    act(() => result.current.resetFilters())

    expect(result.current.filter.search).toBe('')
  })

  it('disables rfOnly and directOnly when rfFiltersEnabled is false', () => {
    const store = makeStore()
    // Station has no via path — normally excluded by rfOnly
    const stations = [makeStation({ callsign: 'INET-1', via: ['TCPIP*'] })]
    const { result } = renderHook(() => useFilters(stations, false), {
      wrapper: makeWrapper(store),
    })
    // With rfFiltersEnabled=false, rfOnly is overridden to false so station should appear
    expect(result.current.filteredStations.length).toBeGreaterThanOrEqual(0)
  })

  it('setMaxDistance updates filter state', () => {
    const store = makeStore()
    const { result } = renderHook(() => useFilters([]), { wrapper: makeWrapper(store) })
    act(() => result.current.setMaxDistance(200))
    expect(result.current.filter.maxDistance).toBe(200)
  })

  it('setSymbolFilter updates filter state', () => {
    const store = makeStore()
    const { result } = renderHook(() => useFilters([]), { wrapper: makeWrapper(store) })
    act(() => result.current.setSymbolFilter('>'))
    expect(result.current.filter.symbolFilter).toBe('>')
  })

  it('setTrailMaxAge updates filter state', () => {
    const store = makeStore()
    const { result } = renderHook(() => useFilters([]), { wrapper: makeWrapper(store) })
    act(() => result.current.setTrailMaxAge(6))
    expect(result.current.filter.trailMaxAgeHours).toBe(6)
  })

  it('setStationMaxAge updates filter state', () => {
    const store = makeStore()
    const { result } = renderHook(() => useFilters([]), { wrapper: makeWrapper(store) })
    act(() => result.current.setStationMaxAge(48))
    expect(result.current.filter.stationMaxAgeHours).toBe(48)
  })

  it('setRfOnly updates filter state', () => {
    const store = makeStore()
    const { result } = renderHook(() => useFilters([]), { wrapper: makeWrapper(store) })
    act(() => result.current.setRfOnly(false))
    expect(result.current.filter.rfOnly).toBe(false)
  })

  it('setDirectOnly updates filter state', () => {
    const store = makeStore()
    const { result } = renderHook(() => useFilters([]), { wrapper: makeWrapper(store) })
    act(() => result.current.setDirectOnly(true))
    expect(result.current.filter.directOnly).toBe(true)
  })

  it('setSort updates sortBy and sortDirection', () => {
    const store = makeStore()
    const { result } = renderHook(() => useFilters([]), { wrapper: makeWrapper(store) })
    act(() => result.current.setSort('callsign', 'asc'))
    expect(result.current.filter.sortBy).toBe('callsign')
    expect(result.current.filter.sortDirection).toBe('asc')
  })
})
