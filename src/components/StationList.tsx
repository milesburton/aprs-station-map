import type { FC } from 'react'
import { APRS_SYMBOLS } from '../constants'
import type { Station } from '../types'
import { formatBearing, formatDistance, formatRelativeTime } from '../utils'

interface StationListProps {
  stations: Station[]
  selectedStation: string | null
  onSelectStation: (callsign: string) => void
}

interface StationItemProps {
  station: Station
  isSelected: boolean
  onSelect: () => void
}

const StationItem: FC<StationItemProps> = ({ station, isSelected, onSelect }) => (
  <li className={`station-item ${isSelected ? 'selected' : ''}`}>
    <button type="button" onClick={onSelect} className="station-button">
      <div className="station-header">
        <span className="callsign">{station.callsign}</span>
        <span className="symbol" title={APRS_SYMBOLS[station.symbol] ?? 'Unknown'}>
          {station.symbol}
        </span>
      </div>
      <div className="station-details">
        <span className="distance">
          {formatDistance(station.distance)} {formatBearing(station.bearing)}
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
  onSelectStation,
}) => (
  <div className="station-list">
    <div className="station-count">{stations.length} stations</div>
    <ul>
      {stations.map((station) => (
        <StationItem
          key={station.callsign}
          station={station}
          isSelected={station.callsign === selectedStation}
          onSelect={() => onSelectStation(station.callsign)}
        />
      ))}
    </ul>
  </div>
)
