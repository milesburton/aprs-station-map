import type { FC } from 'react'
import { getStationStats } from '../services'
import type { Station } from '../types'
import { formatDistance, formatRelativeTime } from '../utils'

interface StatusBarProps {
  stations: Station[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  onRefresh: () => void
}

export const StatusBar: FC<StatusBarProps> = ({
  stations,
  loading,
  error,
  lastUpdated,
  onRefresh,
}) => {
  const { total, avgDistance, furthest } = getStationStats(stations)

  return (
    <div className="status-bar">
      <div className="status-info">
        <span className="stat">
          <strong>{total}</strong> stations
        </span>
        {total > 0 && (
          <>
            <span className="stat">
              Avg: <strong>{formatDistance(avgDistance)}</strong>
            </span>
            {furthest && (
              <span className="stat">
                Furthest: <strong>{furthest.callsign}</strong> ({formatDistance(furthest.distance)})
              </span>
            )}
          </>
        )}
      </div>

      <div className="status-actions">
        {error && <span className="error">{error}</span>}
        {lastUpdated && (
          <span className="last-updated">Updated {formatRelativeTime(lastUpdated)}</span>
        )}
        <button type="button" onClick={onRefresh} disabled={loading} className="refresh-button">
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
    </div>
  )
}
