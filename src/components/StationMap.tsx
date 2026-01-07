import type { FC } from 'react'
import { Circle, MapContainer, TileLayer, useMapEvents } from 'react-leaflet'
import { BEXLEY_LOCATION, DEFAULT_CONFIG, MAP_ATTRIBUTION, MAP_TILE_URL } from '../constants'
import type { Coordinates, Station } from '../types'
import { StationMarker } from './StationMarker'

interface StationMapProps {
  stations: Station[]
  selectedStation: string | null
  centre: Coordinates
  zoom: number
  onSelectStation: (callsign: string | null) => void
  onMapMove: (centre: Coordinates, zoom: number) => void
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

const distanceRings = [50, 100, 200, 300, 400, 500]

export const StationMap: FC<StationMapProps> = ({
  stations,
  selectedStation,
  centre,
  zoom,
  onSelectStation,
  onMapMove,
}) => (
  <MapContainer
    center={[centre.latitude, centre.longitude]}
    zoom={zoom}
    className="station-map"
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

    {stations.map((station) => (
      <StationMarker
        key={station.callsign}
        station={station}
        isSelected={station.callsign === selectedStation}
        onSelect={onSelectStation}
      />
    ))}
  </MapContainer>
)
