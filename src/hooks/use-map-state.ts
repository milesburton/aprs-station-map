import { useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  followStation as followStationAction,
  selectStation as selectStationAction,
  setCentre as setCentreAction,
  setMapPosition,
  setZoom as setZoomAction,
} from '../store/slices/mapSlice'
import type { Coordinates, MapState } from '../types'

interface UseMapStateResult {
  mapState: MapState
  setCentre: (centre: Coordinates) => void
  setZoom: (zoom: number) => void
  selectStation: (callsign: string | null) => void
  followStation: (callsign: string | null) => void
  flyTo: (coords: Coordinates, zoom?: number) => void
}

export const useMapState = (): UseMapStateResult => {
  const dispatch = useAppDispatch()
  const mapState = useAppSelector((state) => state.map)

  const setCentre = useCallback(
    (centre: Coordinates) => dispatch(setCentreAction(centre)),
    [dispatch]
  )

  const setZoom = useCallback((zoom: number) => dispatch(setZoomAction(zoom)), [dispatch])

  const selectStation = useCallback(
    (callsign: string | null) => dispatch(selectStationAction(callsign)),
    [dispatch]
  )

  const followStation = useCallback(
    (callsign: string | null) => dispatch(followStationAction(callsign)),
    [dispatch]
  )

  const flyTo = useCallback(
    (coords: Coordinates, zoom?: number) => {
      if (zoom !== undefined) {
        dispatch(setMapPosition({ centre: coords, zoom }))
      } else {
        dispatch(setCentreAction(coords))
      }
    },
    [dispatch]
  )

  return { mapState, setCentre, setZoom, selectStation, followStation, flyTo }
}
