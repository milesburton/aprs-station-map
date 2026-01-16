import type { FC } from 'react'
import { APRS_SYMBOLS } from '../constants'
import type { Station } from '../types'
import { formatBearing, formatDistance, formatRelativeTime } from '../utils'

interface StationListProps {
  stations: Station[]
  selectedStation: string | null
  followedStation: string | null
  onSelectStation: (callsign: string) => void
}

interface StationItemProps {
  station: Station
  isSelected: boolean
  isFollowed: boolean
  onSelect: () => void
}

const StationItem: FC<StationItemProps> = ({ station, isSelected, isFollowed, onSelect }) => (
  <li className={`station-item ${isSelected ? 'selected' : ''} ${isFollowed ? 'followed' : ''}`}>
    <button type="button" onClick={onSelect} className="station-button">
      <div className="station-header">
        <span className="callsign">
          {isFollowed && (
            <span className="follow-indicator" title="Following">
              ●
            </span>
          )}
          {station.callsign}
        </span>
        <span className="symbol" title={APRS_SYMBOLS[station.symbol]?.name ?? 'Unknown'}>
          {station.symbol}
        </span>
      </div>
      <div className="station-details">
        <span className="distance">
          {station.distance != null && station.bearing != null
            ? `${formatDistance(station.distance)} ${formatBearing(station.bearing)}`
            : 'No position'}
        </span>
        <span className="last-heard">{formatRelativeTime(station.lastHeard)}</span>
      </div>
      {station.comment && <div className="station-comment">{station.comment}</div>}
    </button>
  </li>
)

export const StationList: FC<StationListProps> = ({
  stations,
  selectedStation,
  followedStation,
  onSelectStation,
}) => (
  <div className="station-list">
    <div className="station-count">
      {stations.length} stations
      {followedStation && <span className="following-label"> · Following: {followedStation}</span>}
    </div>
    <ul>
      {stations.map((station) => (
        <StationItem
          key={station.callsign}
          station={station}
          isSelected={station.callsign === selectedStation}
          isFollowed={station.callsign === followedStation}
          onSelect={() => onSelectStation(station.callsign)}
        />
      ))}
    </ul>
  </div>
)
