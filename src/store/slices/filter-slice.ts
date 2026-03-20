import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { DEFAULT_FILTER_STATE } from '../../constants'
import type { FilterState, SortDirection, SortField } from '../../types'

const initialState: FilterState = DEFAULT_FILTER_STATE

const filterSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    setSearch: (state, action: PayloadAction<string>) => {
      state.search = action.payload
    },
    setMaxDistance: (state, action: PayloadAction<number>) => {
      state.maxDistance = action.payload
    },
    setSymbolFilter: (state, action: PayloadAction<string | null>) => {
      state.symbolFilter = action.payload
    },
    setHideNoPosition: (state, action: PayloadAction<boolean>) => {
      state.hideNoPosition = action.payload
    },
    setSort: (state, action: PayloadAction<{ field: SortField; direction: SortDirection }>) => {
      state.sortBy = action.payload.field
      state.sortDirection = action.payload.direction
    },
    setSortBy: (state, action: PayloadAction<SortField>) => {
      state.sortBy = action.payload
    },
    setSortDirection: (state, action: PayloadAction<SortDirection>) => {
      state.sortDirection = action.payload
    },
    setTrailMaxAge: (state, action: PayloadAction<number>) => {
      state.trailMaxAgeHours = action.payload
    },
    setStationMaxAge: (state, action: PayloadAction<number>) => {
      state.stationMaxAgeHours = action.payload
    },
    setRfOnly: (state, action: PayloadAction<boolean>) => {
      state.rfOnly = action.payload
    },
    setDirectOnly: (state, action: PayloadAction<boolean>) => {
      state.directOnly = action.payload
    },
    resetFilters: () => DEFAULT_FILTER_STATE,
  },
})

export const {
  setSearch,
  setMaxDistance,
  setSymbolFilter,
  setHideNoPosition,
  setSort,
  setSortBy,
  setSortDirection,
  setTrailMaxAge,
  setStationMaxAge,
  setRfOnly,
  setDirectOnly,
  resetFilters,
} = filterSlice.actions

export default filterSlice.reducer
