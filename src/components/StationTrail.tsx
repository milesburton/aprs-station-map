import type { FC } from 'react'
import { useMemo } from 'react'
import { Polyline } from 'react-leaflet'
import type { AprsPacket } from '../types'

interface StationTrailProps {
  history: AprsPacket[]
  maxAgeHours?: number
}

// Convert age (0 = newest, 1 = oldest) to color (green to red gradient)
const getTrailColor = (ageRatio: number): string => {
  // Interpolate from green (newest) to red (oldest)
  // Green: rgb(34, 197, 94) - Tailwind green-500
  // Red: rgb(239, 68, 68) - Tailwind red-500
  const r = Math.round(34 + (239 - 34) * ageRatio)
  const g = Math.round(197 + (68 - 197) * ageRatio)
  const b = Math.round(94 + (68 - 94) * ageRatio)
  return `rgb(${r}, ${g}, ${b})`
}

export const StationTrail: FC<StationTrailProps> = ({ history, maxAgeHours = 24 }) => {
  const trailSegments = useMemo(() => {
    // Filter history to only include packets with positions
    const positionPackets = history.filter((p) => p.position)

    if (positionPackets.length < 2) return []

    // Filter by age
    const now = Date.now()
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000
    const recentPackets = positionPackets.filter((p) => {
      const packetTime = new Date(p.timestamp).getTime()
      return now - packetTime <= maxAgeMs
    })

    if (recentPackets.length < 2) return []

    // Sort by timestamp (oldest first)
    const sorted = [...recentPackets].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    // Calculate time range for color gradient
    const oldestTime = new Date(sorted[0].timestamp).getTime()
    const newestTime = new Date(sorted[sorted.length - 1].timestamp).getTime()
    const timeRange = newestTime - oldestTime

    // Create segments between consecutive points with color gradient
    const segments: Array<{
      positions: [number, number][]
      color: string
      opacity: number
    }> = []

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i]
      const next = sorted[i + 1]

      if (!current.position || !next.position) continue

      // Calculate age ratio (0 = newest, 1 = oldest)
      const currentTime = new Date(current.timestamp).getTime()
      const ageRatio = timeRange > 0 ? (newestTime - currentTime) / timeRange : 0

      // Calculate opacity (older = more transparent)
      const opacity = 0.4 + (1 - ageRatio) * 0.4 // Range: 0.4 (oldest) to 0.8 (newest)

      segments.push({
        positions: [
          [current.position.latitude, current.position.longitude],
          [next.position.latitude, next.position.longitude],
        ],
        color: getTrailColor(ageRatio),
        opacity,
      })
    }

    return segments
  }, [history, maxAgeHours])

  return (
    <>
      {trailSegments.map((segment) => {
        // Create a unique key from the positions
        const key = `${segment.positions[0][0]}-${segment.positions[0][1]}-${segment.positions[1][0]}-${segment.positions[1][1]}`
        return (
          <Polyline
            key={key}
            positions={segment.positions}
            pathOptions={{
              color: segment.color,
              weight: 3,
              opacity: segment.opacity,
            }}
          />
        )
      })}
    </>
  )
}
