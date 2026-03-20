import { describe, expect, it } from 'vitest'
import mapReducer, {
  clearSelection,
  followStation,
  selectStation,
  setCentre,
  setMapPosition,
  setZoom,
} from './map-slice'

describe('mapSlice', () => {
  it('setCentre updates centre coordinates', () => {
    expect(mapReducer(undefined, setCentre({ latitude: 53.0, longitude: -1.5 })).centre).toEqual({
      latitude: 53.0,
      longitude: -1.5,
    })
  })

  it('setZoom updates zoom level', () => {
    expect(mapReducer(undefined, setZoom(12)).zoom).toBe(12)
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
    expect(mapReducer(undefined, selectStation('M0LHA-9')).selectedStation).toBe('M0LHA-9')
  })

  it('selectStation accepts null to deselect', () => {
    const withSelection = mapReducer(undefined, selectStation('M0LHA-9'))
    expect(mapReducer(withSelection, selectStation(null)).selectedStation).toBeNull()
  })

  it('followStation sets followedStation', () => {
    expect(mapReducer(undefined, followStation('M0LHA-9')).followedStation).toBe('M0LHA-9')
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
