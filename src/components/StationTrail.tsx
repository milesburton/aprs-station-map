import type { FC } from 'react'
import { memo, useMemo } from 'react'
import { Polyline } from 'react-leaflet'
import type { AprsPacket } from '../types'

interface StationTrailProps {
  history: AprsPacket[]
  maxAgeHours?: number
}

// Trail color: green (recent) to red (old)
const TRAIL_COLOR = '#22c55e'

const StationTrailInner: FC<StationTrailProps> = ({ history, maxAgeHours = 24 }) => {
  const trailData = useMemo(() => {
    const positionPackets = history.filter((p) => p.position)

    if (positionPackets.length < 2) {
      return null
    }

    let recentPackets = positionPackets
    if (maxAgeHours > 0) {
      const now = Date.now()
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000
      recentPackets = positionPackets.filter((p) => {
        const packetTime = new Date(p.timestamp).getTime()
        return now - packetTime <= maxAgeMs
      })
    }

    if (recentPackets.length < 2) {
      return null
    }

    const sorted = [...recentPackets].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    // Build single array of positions for one polyline
    const positions: [number, number][] = []
    for (const packet of sorted) {
      if (packet.position) {
        positions.push([packet.position.latitude, packet.position.longitude])
      }
    }

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
  // Check if the last packet changed (most common update)
  const prevLast = prevProps.history[prevProps.history.length - 1]
  const nextLast = nextProps.history[nextProps.history.length - 1]
  if (prevLast?.timestamp !== nextLast?.timestamp) return false
  return true
})
