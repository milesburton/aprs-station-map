import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { BEXLEY_LOCATION, DEFAULT_CONFIG } from '../../constants'
import type { Coordinates, MapState } from '../../types'

const initialState: MapState = {
  centre: BEXLEY_LOCATION,
  zoom: DEFAULT_CONFIG.defaultZoom,
  selectedStation: null,
  followedStation: null,
}

const mapSlice = createSlice({
  name: 'map',
  initialState,
  reducers: {
    setCentre: (state, action: PayloadAction<Coordinates>) => {
      state.centre = action.payload
    },
    setZoom: (state, action: PayloadAction<number>) => {
      state.zoom = action.payload
    },
    setMapPosition: (state, action: PayloadAction<{ centre: Coordinates; zoom: number }>) => {
      state.centre = action.payload.centre
      state.zoom = action.payload.zoom
    },
    selectStation: (state, action: PayloadAction<string | null>) => {
      state.selectedStation = action.payload
    },
    followStation: (state, action: PayloadAction<string | null>) => {
      state.followedStation = action.payload
    },
    clearSelection: (state) => {
      state.selectedStation = null
      state.followedStation = null
    },
  },
})

export const { setCentre, setZoom, setMapPosition, selectStation, followStation, clearSelection } =
  mapSlice.actions

export default mapSlice.reducer
