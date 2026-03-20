import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface ConnectionState {
  connected: boolean
  kissConnected: boolean
}

const initialState: ConnectionState = {
  connected: false,
  kissConnected: false,
}

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.connected = action.payload
    },
    setKissConnected: (state, action: PayloadAction<boolean>) => {
      state.kissConnected = action.payload
    },
    resetConnection: () => initialState,
  },
})

export const { setConnected, setKissConnected, resetConnection } = connectionSlice.actions

export default connectionSlice.reducer
