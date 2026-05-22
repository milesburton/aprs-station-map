import L from 'leaflet'
import type { FC } from 'react'
import { memo, useEffect, useMemo, useRef } from 'react'
import { Marker, Popup } from 'react-leaflet'
import { APRS_SYMBOLS } from '../constants'
import type { AprsPacket, Station } from '../types'
import { formatBearing, formatDistance, formatRelativeTime } from '../utils'
import { StationTrail } from './StationTrail'

interface StationMarkerProps {
  station: Station
  isSelected: boolean
  isFollowed: boolean
  onSelect: (callsign: string) => void
  onFollow: (callsign: string | null) => void
  history: AprsPacket[]
  trailMaxAgeHours: number
}

const iconCache = new Map<string, L.DivIcon>()

const getOrCreateIcon = (symbol: string, isSelected: boolean, isFollowed: boolean): L.DivIcon => {
  const cacheKey = `${symbol}-${isSelected}-${isFollowed}`
  const cached = iconCache.get(cacheKey)
  if (cached) return cached

  const symbolInfo = APRS_SYMBOLS[symbol] ?? {
    name: 'Unknown',
    emoji: '📍',
    color: '#757575',
    category: 'other' as const,
  }

  const backgroundColor = isSelected ? symbolInfo.color : `${symbolInfo.color}dd`
  const borderColor = isFollowed ? '#22c55e' : isSelected ? '#ffffff' : symbolInfo.color
  const borderWidth = isFollowed ? '3px' : '2px'

  const icon = L.divIcon({
    className: `station-marker ${isSelected ? 'selected' : ''} ${isFollowed ? 'followed' : ''} category-${symbolInfo.category}`,
    html: `
      <div class="marker-icon" style="background-color: ${backgroundColor}; border-color: ${borderColor}; border-width: ${borderWidth};">
        <span class="marker-emoji">${symbolInfo.emoji}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })

  iconCache.set(cacheKey, icon)
  return icon
}

const formatUtcTime = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date
  return `${d.toISOString().slice(11, 19)} UTC`
}

const sanitizeComment = (comment: string): string => {
  return comment
    .replace(/\uFFFD/g, '')
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '')
    .trim()
}

const StationMarkerInner: FC<StationMarkerProps> = ({
  station,
  isSelected,
  isFollowed,
  onSelect,
  onFollow,
  history,
  trailMaxAgeHours,
}) => {
  const markerRef = useRef<L.Marker>(null)

  useEffect(() => {
    if (isSelected && markerRef.current) {
      markerRef.current.openPopup()
    }
  }, [isSelected])

  const icon = useMemo(
    () => getOrCreateIcon(station.symbol, isSelected, isFollowed),
    [station.symbol, isSelected, isFollowed]
  )

  if (!station.coordinates) return null

  const symbolInfo = APRS_SYMBOLS[station.symbol]
  const symbolName = symbolInfo?.name ?? 'Unknown'

  const handleFollowClick = () => {
    onFollow(isFollowed ? null : station.callsign)
  }

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
        <Popup maxHeight={280} maxWidth={280}>
          <StationPopupBody
            station={station}
            isFollowed={isFollowed}
            symbolName={symbolName}
            symbolEmoji={symbolInfo?.emoji ?? '📍'}
            history={history}
            onFollowClick={handleFollowClick}
          />
        </Popup>
      </Marker>
    </>
  )
}

interface PopupBodyProps {
  station: Station
  isFollowed: boolean
  symbolName: string
  symbolEmoji: string
  history: AprsPacket[]
  onFollowClick: () => void
}

// Pulled into its own memoized component so the popup DOM (which react-leaflet
// keeps mounted alongside the marker) does not get re-rendered for every
// station whenever an unrelated WS update lands.
const StationPopupBodyInner: FC<PopupBodyProps> = ({
  station,
  isFollowed,
  symbolName,
  symbolEmoji,
  history,
  onFollowClick,
}) => {
  const sanitizedComment = station.comment ? sanitizeComment(station.comment) : ''
  const recentHistory = useMemo(() => {
    const out: AprsPacket[] = []
    for (let i = history.length - 1; i >= 0 && out.length < 5; i--) {
      const packet = history[i]
      if (packet) out.push(packet)
    }
    return out
  }, [history])
  return (
    <div className="station-popup">
      <div className="popup-header">
        <h3>{station.callsign}</h3>
        <button
          type="button"
          onClick={onFollowClick}
          className={`follow-btn ${isFollowed ? 'following' : ''}`}
          title={isFollowed ? 'Stop following' : 'Follow this station'}
        >
          {isFollowed ? 'Following' : 'Follow'}
        </button>
      </div>
      <p className="symbol">
        {symbolEmoji} {symbolName}
      </p>
      {sanitizedComment && <p className="comment">{sanitizedComment}</p>}

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

      {recentHistory.length > 0 && (
        <div className="history">
          <strong>Recent Activity ({history.length}):</strong>
          <div className="history-list">
            {recentHistory.map((packet, i) => (
              <div key={`${packet.timestamp}-${i}`} className="history-item">
                <span className="history-time">{formatUtcTime(packet.timestamp)}</span>
                {packet.position && (
                  <span className="history-pos">
                    {packet.position.latitude.toFixed(4)}°, {packet.position.longitude.toFixed(4)}°
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const StationPopupBody = memo(StationPopupBodyInner, (prev, next) => {
  if (prev.isFollowed !== next.isFollowed) return false
  if (prev.symbolName !== next.symbolName) return false
  if (prev.symbolEmoji !== next.symbolEmoji) return false
  if (prev.onFollowClick !== next.onFollowClick) return false
  if (prev.history !== next.history) return false
  const a = prev.station
  const b = next.station
  return (
    a.callsign === b.callsign &&
    a.lastHeard === b.lastHeard &&
    a.packetCount === b.packetCount &&
    a.comment === b.comment
  )
})

type Coords = { latitude: number; longitude: number } | null

const coordsEqual = (a: Coords, b: Coords): boolean => {
  if ((a === null) !== (b === null)) return false
  if (a !== null && b !== null) {
    return a.latitude === b.latitude && a.longitude === b.longitude
  }
  return true
}

export const StationMarker = memo(StationMarkerInner, (prevProps, nextProps) => {
  if (prevProps.isSelected !== nextProps.isSelected) return false
  if (prevProps.isFollowed !== nextProps.isFollowed) return false
  if (prevProps.trailMaxAgeHours !== nextProps.trailMaxAgeHours) return false
  if (prevProps.history.length !== nextProps.history.length) return false
  const prevStation = prevProps.station
  const nextStation = nextProps.station
  if (prevStation.callsign !== nextStation.callsign) return false
  if (prevStation.lastHeard !== nextStation.lastHeard) return false
  if (prevStation.packetCount !== nextStation.packetCount) return false
  if (prevStation.comment !== nextStation.comment) return false
  if (prevStation.symbol !== nextStation.symbol) return false
  return coordsEqual(prevStation.coordinates, nextStation.coordinates)
})
