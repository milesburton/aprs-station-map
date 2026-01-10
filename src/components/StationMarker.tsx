import L from 'leaflet'
import type { FC } from 'react'
import { memo, useEffect, useRef } from 'react'
import { Marker, Popup } from 'react-leaflet'
import { APRS_SYMBOLS } from '../constants'
import type { AprsPacket, Station } from '../types'
import { formatBearing, formatDistance, formatRelativeTime } from '../utils'
import { StationTrail } from './StationTrail'

interface StationMarkerProps {
  station: Station
  isSelected: boolean
  onSelect: (callsign: string) => void
  history: AprsPacket[]
  trailMaxAgeHours: number
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

const formatUtcTime = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date
  return `${d.toISOString().slice(11, 19)} UTC`
}

const StationMarkerInner: FC<StationMarkerProps> = ({
  station,
  isSelected,
  onSelect,
  history,
  trailMaxAgeHours,
}) => {
  const markerRef = useRef<L.Marker>(null)

  // Open popup when station is selected
  useEffect(() => {
    if (isSelected && markerRef.current) {
      markerRef.current.openPopup()
    }
  }, [isSelected])

  if (!station.coordinates) return null

  const icon = createIcon(station.symbol, isSelected)
  const symbolInfo = APRS_SYMBOLS[station.symbol]
  const symbolName = symbolInfo?.name ?? 'Unknown'

  return (
    <>
      <StationTrail history={history} maxAgeHours={trailMaxAgeHours} />
      <Marker
        ref={markerRef}
        position={[station.coordinates.latitude, station.coordinates.longitude]}
        icon={icon}
        eventHandlers={{
          click: () => onSelect(station.callsign),
        }}
      >
        <Popup maxHeight={300} maxWidth={350}>
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
                <strong>Last Heard:</strong> {formatRelativeTime(station.lastHeard)} (
                {formatUtcTime(station.lastHeard)})
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

            {history.length > 0 && (
              <div className="history">
                <strong>Recent Activity ({history.length}):</strong>
                <div className="history-list">
                  {[...history]
                    .reverse()
                    .slice(0, 5)
                    .map((packet, i) => (
                      <div key={`${packet.timestamp}-${i}`} className="history-item">
                        <span className="history-time">{formatUtcTime(packet.timestamp)}</span>
                        {packet.position && (
                          <span className="history-pos">
                            {packet.position.latitude.toFixed(4)}°,{' '}
                            {packet.position.longitude.toFixed(4)}°
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </Popup>
      </Marker>
    </>
  )
}

// Memoize to prevent re-renders when other stations update
// Only re-render when this specific station's data changes
export const StationMarker = memo(StationMarkerInner, (prevProps, nextProps) => {
  // Return true if props are equal (no re-render needed)
  if (prevProps.isSelected !== nextProps.isSelected) return false
  if (prevProps.trailMaxAgeHours !== nextProps.trailMaxAgeHours) return false
  if (prevProps.history.length !== nextProps.history.length) return false

  // Deep compare station - only check fields that affect rendering
  const prevStation = prevProps.station
  const nextStation = nextProps.station
  if (prevStation.callsign !== nextStation.callsign) return false
  if (prevStation.lastHeard !== nextStation.lastHeard) return false
  if (prevStation.packetCount !== nextStation.packetCount) return false
  if (prevStation.comment !== nextStation.comment) return false
  if (prevStation.symbol !== nextStation.symbol) return false
  if (prevStation.coordinates?.latitude !== nextStation.coordinates?.latitude) return false
  if (prevStation.coordinates?.longitude !== nextStation.coordinates?.longitude) return false

  return true
})
