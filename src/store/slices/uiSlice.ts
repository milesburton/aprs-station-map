import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type TabId = 'stats' | 'packets' | 'spectrum' | 'status' | 'about'

// Height constraints per tab: { default, min, max }
export const TAB_HEIGHT_CONSTRAINTS: Record<TabId, { default: number; min: number; max: number }> =
  {
    stats: { default: 90, min: 60, max: 120 },
    packets: { default: 200, min: 100, max: 300 },
    spectrum: { default: 150, min: 100, max: 400 },
    status: { default: 60, min: 60, max: 80 },
    about: { default: 60, min: 60, max: 80 },
  }

// Default heights for each tab (for backwards compatibility)
export const TAB_HEIGHTS: Record<TabId, number> = {
  stats: TAB_HEIGHT_CONSTRAINTS.stats.default,
  packets: TAB_HEIGHT_CONSTRAINTS.packets.default,
  spectrum: TAB_HEIGHT_CONSTRAINTS.spectrum.default,
  status: TAB_HEIGHT_CONSTRAINTS.status.default,
  about: TAB_HEIGHT_CONSTRAINTS.about.default,
}

export interface UIState {
  diagnosticsOpen: boolean
  diagnosticsHeight: number
  activeTab: TabId
  userResizedHeight: boolean // Track if user manually resized
  spectrumPoppedOut: boolean // Track if spectrum is in a popout window
}

const initialState: UIState = {
  diagnosticsOpen: false,
  diagnosticsHeight: TAB_HEIGHTS.stats,
  activeTab: 'stats',
  userResizedHeight: false,
  spectrumPoppedOut: false,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleDiagnostics: (state) => {
      state.diagnosticsOpen = !state.diagnosticsOpen
    },
    setDiagnosticsOpen: (state, action: PayloadAction<boolean>) => {
      state.diagnosticsOpen = action.payload
    },
    setDiagnosticsHeight: (state, action: PayloadAction<number>) => {
      state.diagnosticsHeight = action.payload
      state.userResizedHeight = true
    },
    setActiveTab: (state, action: PayloadAction<TabId>) => {
      const newTab = action.payload
      state.activeTab = newTab
      const constraints = TAB_HEIGHT_CONSTRAINTS[newTab]
      // If user hasn't manually resized, use default height
      // Otherwise, clamp current height to new tab's constraints
      if (!state.userResizedHeight) {
        state.diagnosticsHeight = constraints.default
      } else {
        state.diagnosticsHeight = Math.min(
          constraints.max,
          Math.max(constraints.min, state.diagnosticsHeight)
        )
      }
    },
    resetUserResize: (state) => {
      state.userResizedHeight = false
      state.diagnosticsHeight = TAB_HEIGHTS[state.activeTab]
    },
    setSpectrumPoppedOut: (state, action: PayloadAction<boolean>) => {
      state.spectrumPoppedOut = action.payload
    },
  },
})

export const {
  toggleDiagnostics,
  setDiagnosticsOpen,
  setDiagnosticsHeight,
  setActiveTab,
  resetUserResize,
  setSpectrumPoppedOut,
} = uiSlice.actions

export default uiSlice.reducer
