import type { FC } from 'react'
import { memo, useMemo } from 'react'
import { Polyline } from 'react-leaflet'
import type { AprsPacket } from '../types'

interface StationTrailProps {
  history: AprsPacket[]
  maxAgeHours?: number
}

const TRAIL_COLOR = '#22c55e'

const collectTrailPositions = (history: AprsPacket[], cutoff: number): [number, number][] => {
  const positions: [number, number][] = []
  for (const packet of history) {
    const pos = packet.position
    if (!pos) continue
    if (cutoff > 0 && new Date(packet.timestamp).getTime() < cutoff) continue
    positions.push([pos.latitude, pos.longitude])
  }
  return positions
}

const StationTrailInner: FC<StationTrailProps> = ({ history, maxAgeHours = 24 }) => {
  const trailData = useMemo(() => {
    // useStations appends packets in arrival order, so history is already
    // chronological. Walk it once instead of filter+sort+map per call.
    const cutoff = maxAgeHours > 0 ? Date.now() - maxAgeHours * 60 * 60 * 1000 : 0
    const positions = collectTrailPositions(history, cutoff)
    return positions.length >= 2 ? positions : null
  }, [history, maxAgeHours])

  if (!trailData) return null

  return (
    <Polyline
      positions={trailData}
      pathOptions={{
        color: TRAIL_COLOR,
        weight: 3,
        opacity: 0.7,
      }}
    />
  )
}

export const StationTrail = memo(StationTrailInner, (prevProps, nextProps) => {
  if (prevProps.maxAgeHours !== nextProps.maxAgeHours) return false
  if (prevProps.history.length !== nextProps.history.length) return false
  const prevLast = prevProps.history[prevProps.history.length - 1]
  const nextLast = nextProps.history[nextProps.history.length - 1]
  if (prevLast?.timestamp !== nextLast?.timestamp) return false
  const prevFirst = prevProps.history[0]
  const nextFirst = nextProps.history[0]
  if (prevFirst?.timestamp !== nextFirst?.timestamp) return false
  return true
})
