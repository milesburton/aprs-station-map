import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AprsPacket, Station, Stats } from '../../types'

const MAX_PACKETS = 100
const MAX_STATION_HISTORY = 50

export interface DataState {
  stations: Station[]
  packets: AprsPacket[]
  stationHistory: Record<string, AprsPacket[]>
  stats: Stats | null
  loading: boolean
  error: string | null
  lastUpdated: string | null // ISO string for serialization
}

const initialState: DataState = {
  stations: [],
  packets: [],
  stationHistory: {},
  stats: null,
  loading: true,
  error: null,
  lastUpdated: null,
}

// Deduplicate stations by callsign, keeping the most recent
const deduplicateStations = (stations: Station[]): Station[] => {
  const map = new Map<string, Station>()
  for (const station of stations) {
    const existing = map.get(station.callsign)
    if (!existing) {
      map.set(station.callsign, station)
    } else {
      const existingTime =
        typeof existing.lastHeard === 'string'
          ? new Date(existing.lastHeard).getTime()
          : existing.lastHeard.getTime()
      const newTime =
        typeof station.lastHeard === 'string'
          ? new Date(station.lastHeard).getTime()
          : station.lastHeard.getTime()
      if (newTime > existingTime) {
        map.set(station.callsign, station)
      }
    }
  }
  return Array.from(map.values())
}

const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    setStations: (state, action: PayloadAction<Station[]>) => {
      state.stations = deduplicateStations(action.payload)
      state.loading = false
      state.lastUpdated = new Date().toISOString()
    },
    updateStation: (state, action: PayloadAction<Station>) => {
      const updatedStation = action.payload
      const index = state.stations.findIndex((s) => s.callsign === updatedStation.callsign)
      if (index >= 0) {
        state.stations[index] = updatedStation
      } else {
        state.stations.unshift(updatedStation)
      }
      state.lastUpdated = new Date().toISOString()
    },
    addPacket: (state, action: PayloadAction<AprsPacket>) => {
      const packet = action.payload
      state.packets.push(packet)
      if (state.packets.length > MAX_PACKETS) {
        state.packets = state.packets.slice(-MAX_PACKETS)
      }
      // Update station history
      const callsign = packet.source
      const existing = state.stationHistory[callsign] ?? []
      const updated = [...existing, packet].slice(-MAX_STATION_HISTORY)
      state.stationHistory[callsign] = updated
    },
    setStats: (state, action: PayloadAction<Stats>) => {
      state.stats = action.payload
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    clearData: () => initialState,
  },
})

export const { setStations, updateStation, addPacket, setStats, setLoading, setError, clearData } =
  dataSlice.actions

export default dataSlice.reducer
