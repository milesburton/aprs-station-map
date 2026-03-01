import type { FC, ReactNode } from 'react'
import { memo, useMemo } from 'react'
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMapEvents } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { BEXLEY_LOCATION, DEFAULT_CONFIG, MAP_ATTRIBUTION, MAP_TILE_URL } from '../constants'
import type { AprsPacket, Coordinates, Station } from '../types'
import { StationMarker } from './StationMarker'

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
}> = ({ onMove }) => {
  useMapEvents({
    moveend: (e) => {
      const map = e.target
      const centre = map.getCenter()
      onMove({ latitude: centre.lat, longitude: centre.lng }, map.getZoom())
    },
  })
  return null
}

const EMPTY_HISTORY: AprsPacket[] = []

const distanceRings = [50, 100, 200, 300, 400, 500]

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
}): ReactNode => (
  <MapContainer
    center={[centre.latitude, centre.longitude]}
    zoom={zoom}
    className="w-full h-full"
    scrollWheelZoom={true}
  >
    <TileLayer url={MAP_TILE_URL} attribution={MAP_ATTRIBUTION} />

    <MapEventHandler onMove={onMapMove} />

    {distanceRings.map((radius) => (
      <Circle
        key={radius}
        center={[BEXLEY_LOCATION.latitude, BEXLEY_LOCATION.longitude]}
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
      center={[BEXLEY_LOCATION.latitude, BEXLEY_LOCATION.longitude]}
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
      center={[BEXLEY_LOCATION.latitude, BEXLEY_LOCATION.longitude]}
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
            <strong>Location:</strong> Bexley, London
          </p>
          <p>
            <strong>Coordinates:</strong> {BEXLEY_LOCATION.latitude.toFixed(4)}°,{' '}
            {BEXLEY_LOCATION.longitude.toFixed(4)}°
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
      {stations.map((station) => (
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

export const StationMap: FC<StationMapProps> = memo(
  StationMapInner,
  (prevProps, nextProps) => {
    if (prevProps.centre.latitude !== nextProps.centre.latitude) return false
    if (prevProps.centre.longitude !== nextProps.centre.longitude) return false
    if (prevProps.zoom !== nextProps.zoom) return false
    if (prevProps.trailMaxAgeHours !== nextProps.trailMaxAgeHours) return false
    if (prevProps.stations.length !== nextProps.stations.length) return false
    if (prevProps.stations !== nextProps.stations) {
      for (let i = 0; i < Math.min(5, prevProps.stations.length); i++) {
        const prev = prevProps.stations[i]
        const next = nextProps.stations[i]
        if (prev?.callsign !== next?.callsign) return false
        if (prev?.coordinates?.latitude !== next?.coordinates?.latitude) return false
        if (prev?.coordinates?.longitude !== next?.coordinates?.longitude) return false
        if (prev?.lastHeard !== next?.lastHeard) return false
      }
    }
    return true
  }
)
