import type { FC } from 'react'
import { useMemo } from 'react'
import { Polyline } from 'react-leaflet'
import type { AprsPacket } from '../types'

interface StationTrailProps {
  history: AprsPacket[]
  maxAgeHours?: number
}

const getTrailColor = (ageRatio: number): string => {
  const r = Math.round(34 + (239 - 34) * ageRatio)
  const g = Math.round(197 + (68 - 197) * ageRatio)
  const b = Math.round(94 + (68 - 94) * ageRatio)
  return `rgb(${r}, ${g}, ${b})`
}

export const StationTrail: FC<StationTrailProps> = ({ history, maxAgeHours = 24 }) => {
  const trailSegments = useMemo(() => {
    const positionPackets = history.filter((p) => p.position)

    if (positionPackets.length < 2) {
      console.log(
        '[Trail] Not enough position packets:',
        positionPackets.length,
        'maxAge:',
        maxAgeHours
      )
      return []
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
      console.log('[Trail] Not enough recent packets after filtering:', recentPackets.length)
      return []
    }

    const sorted = [...recentPackets].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    const oldestTime = new Date(sorted[0].timestamp).getTime()
    const newestTime = new Date(sorted[sorted.length - 1].timestamp).getTime()
    const timeRange = newestTime - oldestTime

    const segments: Array<{
      positions: [number, number][]
      color: string
      opacity: number
    }> = []

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i]
      const next = sorted[i + 1]

      if (!current?.position || !next?.position) continue

      const currentTime = new Date(current.timestamp).getTime()
      const ageRatio = timeRange > 0 ? (newestTime - currentTime) / timeRange : 0
      const opacity = 0.4 + (1 - ageRatio) * 0.4

      segments.push({
        positions: [
          [current.position.latitude, current.position.longitude],
          [next.position.latitude, next.position.longitude],
        ],
        color: getTrailColor(ageRatio),
        opacity,
      })
    }

    console.log('[Trail] Generated', segments.length, 'trail segments')
    return segments
  }, [history, maxAgeHours])

  return (
    <>
      {trailSegments.map((segment) => {
        const pos1 = segment.positions[0]
        const pos2 = segment.positions[1]
        if (!pos1 || !pos2) return null

        const key = `${pos1[0]}-${pos1[1]}-${pos2[0]}-${pos2[1]}`
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
