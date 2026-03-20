import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTER_STATE } from '../../constants'
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
} from './filter-slice'

describe('filterSlice', () => {
  it('has correct initial state', () => {
    expect(filterReducer(undefined, { type: '@@init' })).toEqual(DEFAULT_FILTER_STATE)
  })

  it('setSearch updates search term', () => {
    expect(filterReducer(undefined, setSearch('G4')).search).toBe('G4')
  })

  it('setMaxDistance updates maxDistance', () => {
    expect(filterReducer(undefined, setMaxDistance(100)).maxDistance).toBe(100)
  })

  it('setSymbolFilter sets symbol filter', () => {
    expect(filterReducer(undefined, setSymbolFilter('/')).symbolFilter).toBe('/')
  })

  it('setSymbolFilter accepts null', () => {
    expect(filterReducer(undefined, setSymbolFilter(null)).symbolFilter).toBeNull()
  })

  it('setHideNoPosition updates flag', () => {
    expect(filterReducer(undefined, setHideNoPosition(true)).hideNoPosition).toBe(true)
  })

  it('setSort updates sortBy and sortDirection together', () => {
    const state = filterReducer(undefined, setSort({ field: 'callsign', direction: 'asc' }))
    expect(state.sortBy).toBe('callsign')
    expect(state.sortDirection).toBe('asc')
  })

  it('setSortBy updates only sortBy', () => {
    expect(filterReducer(undefined, setSortBy('distance')).sortBy).toBe('distance')
  })

  it('setSortDirection updates only sortDirection', () => {
    expect(filterReducer(undefined, setSortDirection('asc')).sortDirection).toBe('asc')
  })

  it('setTrailMaxAge updates trailMaxAgeHours', () => {
    expect(filterReducer(undefined, setTrailMaxAge(12)).trailMaxAgeHours).toBe(12)
  })

  it('setStationMaxAge updates stationMaxAgeHours', () => {
    expect(filterReducer(undefined, setStationMaxAge(48)).stationMaxAgeHours).toBe(48)
  })

  it('setRfOnly updates rfOnly', () => {
    expect(filterReducer(undefined, setRfOnly(false)).rfOnly).toBe(false)
  })

  it('setDirectOnly updates directOnly', () => {
    expect(filterReducer(undefined, setDirectOnly(true)).directOnly).toBe(true)
  })

  it('resetFilters restores default filter state', () => {
    const modified = filterReducer(undefined, setSearch('XYZ'))
    expect(filterReducer(modified, resetFilters())).toEqual(DEFAULT_FILTER_STATE)
  })
})
