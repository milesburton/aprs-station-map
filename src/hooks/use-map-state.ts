import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_CONFIG } from '../constants'
import type { Coordinates, MapState } from '../types'

const MAP_STATE_STORAGE_KEY = 'aprs-map-state'

const loadMapState = (): MapState => {
  try {
    const saved = localStorage.getItem(MAP_STATE_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<MapState>
      return {
        centre: parsed.centre ?? DEFAULT_CONFIG.stationLocation,
        zoom: parsed.zoom ?? DEFAULT_CONFIG.defaultZoom,
        selectedStation: null, // Don't restore selected station
      }
    }
  } catch {
    // Ignore parse errors
  }
  return {
    centre: DEFAULT_CONFIG.stationLocation,
    zoom: DEFAULT_CONFIG.defaultZoom,
    selectedStation: null,
  }
}

interface UseMapStateResult {
  mapState: MapState
  setCentre: (centre: Coordinates) => void
  setZoom: (zoom: number) => void
  selectStation: (callsign: string | null) => void
  flyTo: (coords: Coordinates, zoom?: number) => void
}

export const useMapState = (): UseMapStateResult => {
  const [mapState, setMapState] = useState<MapState>(loadMapState)

  const setCentre = useCallback(
    (centre: Coordinates) => setMapState((prev) => ({ ...prev, centre })),
    []
  )

  const setZoom = useCallback((zoom: number) => setMapState((prev) => ({ ...prev, zoom })), [])

  // Persist map centre and zoom to localStorage
  useEffect(() => {
    const { selectedStation: _, ...mapToSave } = mapState
    localStorage.setItem(MAP_STATE_STORAGE_KEY, JSON.stringify(mapToSave))
  }, [mapState])

  const selectStation = useCallback(
    (selectedStation: string | null) => setMapState((prev) => ({ ...prev, selectedStation })),
    []
  )

  const flyTo = useCallback(
    (coords: Coordinates, zoom?: number) =>
      setMapState((prev) => ({
        ...prev,
        centre: coords,
        zoom: zoom ?? prev.zoom,
      })),
    []
  )

  return { mapState, setCentre, setZoom, selectStation, flyTo }
}
