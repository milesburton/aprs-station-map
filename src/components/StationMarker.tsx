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

const createIcon = (symbol: string, isSelected: boolean): L.DivIcon => {
  const symbolInfo = APRS_SYMBOLS[symbol] ?? {
    name: 'Unknown',
    emoji: symbol,
    color: '#757575',
    category: 'other' as const,
  }

  const backgroundColor = isSelected ? symbolInfo.color : `${symbolInfo.color}dd`
  const borderColor = isSelected ? '#ffffff' : symbolInfo.color

  return L.divIcon({
    className: `station-marker ${isSelected ? 'selected' : ''} category-${symbolInfo.category}`,
    html: `
      <div class="marker-icon" style="background-color: ${backgroundColor}; border-color: ${borderColor};">
        <span class="marker-emoji">${symbolInfo.emoji}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

export const StationMarker: FC<StationMarkerProps> = ({ station, isSelected, onSelect }) => {
  // Skip rendering if no coordinates
  if (!station.coordinates) return null

  const icon = createIcon(station.symbol, isSelected)
  const symbolInfo = APRS_SYMBOLS[station.symbol]
  const symbolName = symbolInfo?.name ?? 'Unknown'

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
            {symbolInfo?.emoji ?? station.symbol} {symbolName}
          </p>
          {station.comment && <p className="comment">{station.comment}</p>}

          {station.coordinates && (
            <div className="coordinates">
              <strong>Position:</strong>
              <div>Lat: {station.coordinates.latitude.toFixed(4)}°</div>
              <div>Lon: {station.coordinates.longitude.toFixed(4)}°</div>
            </div>
          )}

          <div className="details">
            <div>
              <strong>Last Heard:</strong> {formatRelativeTime(station.lastHeard)}
            </div>
            <div>
              <strong>Packets:</strong> {station.packetCount}
            </div>
            {station.distance != null && station.bearing != null && (
              <div>
                <strong>Distance:</strong> {formatDistance(station.distance)}{' '}
                {formatBearing(station.bearing)}
              </div>
            )}
            {station.signalStrength != null && (
              <div>
                <strong>Signal:</strong> {station.signalStrength.toFixed(1)} dB
              </div>
            )}
          </div>

          {station.via && station.via.length > 0 && (
            <p className="via">via {station.via.join(' → ')}</p>
          )}
        </div>
      </Popup>
    </Marker>
  )
}
