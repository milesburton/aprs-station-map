import L from 'leaflet'
import type { FC } from 'react'
import { Marker, Popup } from 'react-leaflet'
import { APRS_SYMBOLS } from '../constants'
import type { Station } from '../types'
import { formatBearing, formatDistance, formatRelativeTime } from '../utils'

interface StationMarkerProps {
  station: Station
  isSelected: boolean
  onSelect: (callsign: string) => void
}

const createIcon = (symbol: string, isSelected: boolean): L.DivIcon =>
  L.divIcon({
    className: `station-marker ${isSelected ? 'selected' : ''}`,
    html: `<div class="marker-icon">${symbol}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })

export const StationMarker: FC<StationMarkerProps> = ({ station, isSelected, onSelect }) => {
  const icon = createIcon(station.symbol, isSelected)
  const symbolName = APRS_SYMBOLS[station.symbol] ?? 'Unknown'

  return (
    <Marker
      position={[station.coordinates.latitude, station.coordinates.longitude]}
      icon={icon}
      eventHandlers={{ click: () => onSelect(station.callsign) }}
    >
      <Popup>
        <div className="station-popup">
          <h3>{station.callsign}</h3>
          <p className="symbol">
            {station.symbol} {symbolName}
          </p>
          <p className="comment">{station.comment}</p>
          <div className="details">
            <span>
              {formatDistance(station.distance)} {formatBearing(station.bearing)}
            </span>
            <span>{formatRelativeTime(station.lastHeard)}</span>
          </div>
          {station.via && station.via.length > 0 && (
            <p className="via">via {station.via.join(' → ')}</p>
          )}
        </div>
      </Popup>
    </Marker>
  )
}
