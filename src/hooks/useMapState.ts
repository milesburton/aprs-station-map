import { useCallback, useState } from 'react'
import { DEFAULT_CONFIG } from '../constants'
import type { Coordinates, MapState } from '../types'

interface UseMapStateResult {
  mapState: MapState
  setCentre: (centre: Coordinates) => void
  setZoom: (zoom: number) => void
  selectStation: (callsign: string | null) => void
  flyTo: (coords: Coordinates, zoom?: number) => void
}

export const useMapState = (): UseMapStateResult => {
  const [mapState, setMapState] = useState<MapState>({
    centre: DEFAULT_CONFIG.stationLocation,
    zoom: DEFAULT_CONFIG.defaultZoom,
    selectedStation: null,
  })

  const setCentre = useCallback(
    (centre: Coordinates) => setMapState((prev) => ({ ...prev, centre })),
    []
  )

  const setZoom = useCallback((zoom: number) => setMapState((prev) => ({ ...prev, zoom })), [])

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
