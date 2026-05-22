import type { FC, ReactNode } from 'react'
import { memo, useEffect, useMemo, useState } from 'react'
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMapEvents } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { DEFAULT_CONFIG, DEFAULT_LOCATION, MAP_ATTRIBUTION, MAP_TILE_URL } from '../constants'
import type { AprsPacket, Coordinates, Station } from '../types'
import { StationMarker } from './StationMarker'

// Cheap content signature for the station list. We re-render the map when a
// station's identity, position, or last-heard timestamp changes, but not when
// useStations hands us a freshly-allocated array containing the same data.
const stationsSignature = (stations: Station[]): string => {
  let sig = ''
  for (const s of stations) {
    const lh = typeof s.lastHeard === 'string' ? s.lastHeard : s.lastHeard.toISOString()
    const c = s.coordinates
    sig += `${s.callsign}|${lh}|${c ? `${c.latitude},${c.longitude}` : '_'};`
  }
  return sig
}

interface Viewport {
  south: number
  west: number
  north: number
  east: number
}

interface StationMapProps {
  stations: Station[]
  selectedStation: string | null
  followedStation: string | null
  centre: Coordinates
  zoom: number
  onSelectStation: (callsign: string | null) => void
  onFollowStation: (callsign: string | null) => void
  onMapMove: (centre: Coordinates, zoom: number) => void
  stationHistory: Map<string, AprsPacket[]>
  trailMaxAgeHours: number
}

const MapEventHandler: FC<{
  onMove: (centre: Coordinates, zoom: number) => void
  onViewportChange: (viewport: Viewport) => void
}> = ({ onMove, onViewportChange }) => {
  const reportViewport = (map: L.Map): void => {
    const bounds = map.getBounds()
    onViewportChange({
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    })
  }
  const map = useMapEvents({
    moveend: (e) => {
      const m = e.target
      const centre = m.getCenter()
      onMove({ latitude: centre.lat, longitude: centre.lng }, m.getZoom())
      reportViewport(m)
    },
    zoomend: (e) => reportViewport(e.target),
  })
  // Report initial viewport once so the first paint is already filtered.
  useEffect(() => {
    if (map) reportViewport(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])
  return null
}

const EMPTY_HISTORY: AprsPacket[] = []

const distanceRings = [50, 100, 200, 300, 400, 500]

const isInViewport = (station: Station, viewport: Viewport, paddingDeg: number): boolean => {
  const coords = station.coordinates
  if (!coords) return false
  const { latitude: lat, longitude: lng } = coords
  return (
    lat >= viewport.south - paddingDeg &&
    lat <= viewport.north + paddingDeg &&
    lng >= viewport.west - paddingDeg &&
    lng <= viewport.east + paddingDeg
  )
}

const StationMapInner: FC<StationMapProps> = ({
  stations,
  selectedStation,
  followedStation,
  centre,
  zoom,
  onSelectStation,
  onFollowStation,
  onMapMove,
  stationHistory,
  trailMaxAgeHours,
}): ReactNode => {
  const [viewport, setViewport] = useState<Viewport | null>(null)

  // Only render markers inside (or near) the visible viewport. Stations far
  // outside add reconcile cost and DOM nodes for clusters the user can't see.
  // The selected and followed stations are always kept so they can't disappear.
  const visibleStations = useMemo(() => {
    if (!viewport) return stations
    const padding = (viewport.north - viewport.south) * 0.5
    return stations.filter(
      (station) =>
        station.callsign === selectedStation ||
        station.callsign === followedStation ||
        isInViewport(station, viewport, padding)
    )
  }, [stations, viewport, selectedStation, followedStation])

  return (
    <MapContainer
      center={[centre.latitude, centre.longitude]}
      zoom={zoom}
      className="w-full h-full"
      scrollWheelZoom={true}
    >
      <TileLayer url={MAP_TILE_URL} attribution={MAP_ATTRIBUTION} />

      <MapEventHandler onMove={onMapMove} onViewportChange={setViewport} />

      {distanceRings.map((radius) => (
        <Circle
          key={radius}
          center={[DEFAULT_LOCATION.latitude, DEFAULT_LOCATION.longitude]}
          radius={radius * 1000}
          pathOptions={{
            color: '#3388ff',
            weight: 1,
            opacity: 0.3,
            fill: false,
          }}
        />
      ))}

      <Circle
        center={[DEFAULT_LOCATION.latitude, DEFAULT_LOCATION.longitude]}
        radius={DEFAULT_CONFIG.maxDistanceKm * 1000}
        pathOptions={{
          color: '#ff3333',
          weight: 2,
          opacity: 0.5,
          fill: false,
          dashArray: '10, 5',
        }}
      />

      <CircleMarker
        center={[DEFAULT_LOCATION.latitude, DEFAULT_LOCATION.longitude]}
        radius={12}
        pathOptions={{
          color: '#ff0000',
          weight: 3,
          opacity: 1,
          fillColor: '#ff0000',
          fillOpacity: 0.7,
        }}
      >
        <Popup>
          <div>
            <h3>🏠 Receiving Station</h3>
            <p>
              <strong>Coordinates:</strong> {DEFAULT_LOCATION.latitude.toFixed(4)}°,{' '}
              {DEFAULT_LOCATION.longitude.toFixed(4)}°
            </p>
            <p>This is the QTH (location) of the receiving station with KISS TNC</p>
          </div>
        </Popup>
      </CircleMarker>

      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={50}
        spiderfyOnMaxZoom={true}
        showCoverageOnHover={false}
        disableClusteringAtZoom={12}
      >
        {visibleStations.map((station) => (
          <StationMarker
            key={station.callsign}
            station={station}
            isSelected={station.callsign === selectedStation}
            isFollowed={station.callsign === followedStation}
            onSelect={onSelectStation}
            onFollow={onFollowStation}
            history={stationHistory.get(station.callsign) ?? EMPTY_HISTORY}
            trailMaxAgeHours={trailMaxAgeHours}
          />
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  )
}

export const StationMap: FC<StationMapProps> = memo(StationMapInner, (prev, next) => {
  if (prev.selectedStation !== next.selectedStation) return false
  if (prev.followedStation !== next.followedStation) return false
  if (prev.trailMaxAgeHours !== next.trailMaxAgeHours) return false
  if (prev.centre !== next.centre) return false
  if (prev.zoom !== next.zoom) return false
  if (prev.onSelectStation !== next.onSelectStation) return false
  if (prev.onFollowStation !== next.onFollowStation) return false
  if (prev.onMapMove !== next.onMapMove) return false
  if (prev.stationHistory !== next.stationHistory) return false
  if (prev.stations === next.stations) return true
  if (prev.stations.length !== next.stations.length) return false
  return stationsSignature(prev.stations) === stationsSignature(next.stations)
})
