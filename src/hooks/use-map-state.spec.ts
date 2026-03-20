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
import { useMapState } from './use-map-state'

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
    createElement(Provider, { store, children })

describe('useMapState', () => {
  it('returns initial map state', () => {
    const store = makeStore()
    const { result } = renderHook(() => useMapState(), { wrapper: makeWrapper(store) })
    expect(result.current.mapState.selectedStation).toBeNull()
    expect(result.current.mapState.followedStation).toBeNull()
  })

  it('setCentre updates centre in store', () => {
    const store = makeStore()
    const { result } = renderHook(() => useMapState(), { wrapper: makeWrapper(store) })
    act(() => result.current.setCentre({ latitude: 53.0, longitude: -2.0 }))
    expect(result.current.mapState.centre).toEqual({ latitude: 53.0, longitude: -2.0 })
  })

  it('setZoom updates zoom in store', () => {
    const store = makeStore()
    const { result } = renderHook(() => useMapState(), { wrapper: makeWrapper(store) })
    act(() => result.current.setZoom(14))
    expect(result.current.mapState.zoom).toBe(14)
  })

  it('selectStation sets selectedStation', () => {
    const store = makeStore()
    const { result } = renderHook(() => useMapState(), { wrapper: makeWrapper(store) })
    act(() => result.current.selectStation('G4ABC'))
    expect(result.current.mapState.selectedStation).toBe('G4ABC')
  })

  it('selectStation accepts null to deselect', () => {
    const store = makeStore()
    const { result } = renderHook(() => useMapState(), { wrapper: makeWrapper(store) })
    act(() => result.current.selectStation('G4ABC'))
    act(() => result.current.selectStation(null))
    expect(result.current.mapState.selectedStation).toBeNull()
  })

  it('followStation sets followedStation', () => {
    const store = makeStore()
    const { result } = renderHook(() => useMapState(), { wrapper: makeWrapper(store) })
    act(() => result.current.followStation('M0LHA-9'))
    expect(result.current.mapState.followedStation).toBe('M0LHA-9')
  })

  it('flyTo with zoom dispatches setMapPosition', () => {
    const store = makeStore()
    const { result } = renderHook(() => useMapState(), { wrapper: makeWrapper(store) })
    act(() => result.current.flyTo({ latitude: 51.5, longitude: -0.1 }, 12))
    expect(result.current.mapState.centre).toEqual({ latitude: 51.5, longitude: -0.1 })
    expect(result.current.mapState.zoom).toBe(12)
  })

  it('flyTo without zoom only updates centre', () => {
    const store = makeStore()
    const { result } = renderHook(() => useMapState(), { wrapper: makeWrapper(store) })
    const initialZoom = result.current.mapState.zoom
    act(() => result.current.flyTo({ latitude: 51.5, longitude: -0.1 }))
    expect(result.current.mapState.centre).toEqual({ latitude: 51.5, longitude: -0.1 })
    expect(result.current.mapState.zoom).toBe(initialZoom)
  })
})
