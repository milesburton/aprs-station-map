import { expect, test } from '@playwright/test'
import { type MockStation, type MockStats, setupWsMock } from './helpers'

// Tunables — override via env to run heavier scenarios locally:
//   LOAD_STATIONS, LOAD_RATE_HZ, LOAD_DURATION_MS
// Defaults are sized to be informative on a dev box without making CI flaky.
const STATION_COUNT = Number(process.env.LOAD_STATIONS ?? 500)
const PACKETS_PER_SEC = Number(process.env.LOAD_RATE_HZ ?? 30)
const DURATION_MS = Number(process.env.LOAD_DURATION_MS ?? 10_000)

const SYMBOLS = ['-', '>', 'v', 'k', 'j', '#', 'r', 'O', '_'] as const

const makeStation = (i: number): MockStation => {
  // Spread stations roughly around the UK so the cluster has something to do
  // at the default zoom. Real APRS-IS feeds look similar in shape.
  const lat = 50 + (i % 50) * 0.1 + Math.random() * 0.05
  const lon = -5 + ((i * 7) % 80) * 0.1 + Math.random() * 0.05
  return {
    callsign: `LOAD${i.toString().padStart(4, '0')}`,
    symbol: SYMBOLS[i % SYMBOLS.length] ?? '-',
    symbolTable: '/',
    coordinates: { latitude: lat, longitude: lon },
    distance: Math.hypot(lat - 51.5, lon + 0.1) * 111,
    bearing: i % 360,
    lastHeard: new Date(Date.now() - (i % 600) * 1000).toISOString(),
    packetCount: 1 + (i % 50),
    comment: `Load test station ${i}`,
  }
}

interface LoadResult {
  longTasksTotalMs: number
  longTaskCount: number
  longestTaskMs: number
  frameCount: number
  fps: number
  packetsSent: number
}

declare global {
  interface Window {
    __wsSend?: (msg: unknown) => void
  }
}

test.describe('load test — WS update throughput', () => {
  test('GUI keeps up with high-frequency station_update bursts', async ({ page }) => {
    const stations: MockStation[] = Array.from({ length: STATION_COUNT }, (_, i) => makeStation(i))
    const stats: MockStats = {
      totalStations: stations.length,
      stationsWithPosition: stations.length,
      totalPackets: stations.reduce((sum, s) => sum + s.packetCount, 0),
      kissConnected: true,
    }

    await setupWsMock(page, stations, stats)
    await page.goto('/')

    // Wait until the initial render is done before we start measuring, so the
    // first-paint cost doesn't pollute the numbers.
    await page.waitForFunction(() => typeof window.__wsSend === 'function')
    await page.waitForSelector('.leaflet-container')
    await page.waitForTimeout(500)

    const result: LoadResult = await page.evaluate(
      async ({ stationCount, rateHz, durationMs }) => {
        // PerformanceObserver gives us "long tasks" — anything >50ms blocking
        // the main thread. requestAnimationFrame counts gives us a rough FPS.
        const longTaskEntries: PerformanceEntry[] = []
        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) longTaskEntries.push(entry)
        })
        try {
          obs.observe({ entryTypes: ['longtask'] })
        } catch {
          // longtask not supported in this browser — keep going, we'll just
          // report zeros for those metrics.
        }

        let frameCount = 0
        let rafActive = true
        const tickFrame = () => {
          if (!rafActive) return
          frameCount++
          requestAnimationFrame(tickFrame)
        }
        requestAnimationFrame(tickFrame)

        // Mutate one station's lastHeard / packetCount each tick so the
        // station_update isn't a no-op for the React diff.
        const send = window.__wsSend
        if (!send) throw new Error('__wsSend not installed')

        // Drive packets in 50ms tick batches rather than one-per-setInterval
        // so high target rates (>~100Hz) actually hit — browsers throttle
        // setInterval below ~4ms and starve at high rates anyway. This more
        // closely mirrors how the real server coalesces and flushes bursts.
        const start = performance.now()
        const tickMs = 50
        const perTick = Math.max(1, Math.round((rateHz * tickMs) / 1000))
        let packetsSent = 0
        let idx = 0
        await new Promise<void>((resolve) => {
          const id = window.setInterval(() => {
            const now = performance.now()
            if (now - start >= durationMs) {
              window.clearInterval(id)
              resolve()
              return
            }
            for (let n = 0; n < perTick; n++) {
              idx = (idx + 1) % stationCount
              const i = idx
              const lat = 50 + (i % 50) * 0.1
              const lon = -5 + ((i * 7) % 80) * 0.1
              send({
                type: 'station_update',
                station: {
                  callsign: `LOAD${i.toString().padStart(4, '0')}`,
                  symbol: '-',
                  symbolTable: '/',
                  coordinates: { latitude: lat, longitude: lon },
                  distance: Math.hypot(lat - 51.5, lon + 0.1) * 111,
                  bearing: i % 360,
                  lastHeard: new Date().toISOString(),
                  packetCount: 1 + (packetsSent % 50),
                  comment: `Load test station ${i}`,
                },
              })
              packetsSent++
            }
          }, tickMs)
        })

        rafActive = false
        // Give the observer one tick to flush any in-flight long tasks.
        await new Promise((r) => setTimeout(r, 100))
        obs.disconnect()

        const elapsedSec = (performance.now() - start) / 1000
        const longTaskTotal = longTaskEntries.reduce((sum, e) => sum + e.duration, 0)
        const longestTask = longTaskEntries.reduce((max, e) => Math.max(max, e.duration), 0)

        return {
          longTasksTotalMs: Math.round(longTaskTotal),
          longTaskCount: longTaskEntries.length,
          longestTaskMs: Math.round(longestTask),
          frameCount,
          fps: Math.round(frameCount / elapsedSec),
          packetsSent,
        }
      },
      {
        stationCount: STATION_COUNT,
        rateHz: PACKETS_PER_SEC,
        durationMs: DURATION_MS,
      }
    )

    const blockedFraction = result.longTasksTotalMs / DURATION_MS
    // Single-line summary so it's easy to compare across runs / branches.
    console.log(
      [
        '[load]',
        `stations=${STATION_COUNT}`,
        `rate=${PACKETS_PER_SEC}Hz`,
        `duration=${DURATION_MS}ms`,
        `sent=${result.packetsSent}`,
        `fps=${result.fps}`,
        `longTasks=${result.longTaskCount}`,
        `blockedMs=${result.longTasksTotalMs}`,
        `blocked=${(blockedFraction * 100).toFixed(1)}%`,
        `longest=${result.longestTaskMs}ms`,
      ].join(' ')
    )

    // Loose bounds — these are signal-not-assertion. Tighten if the perf work
    // lets us hold a tighter contract. Goal: catch a 10× regression, not a 10%
    // one.
    expect(result.packetsSent).toBeGreaterThan(0)
    expect(result.fps).toBeGreaterThan(10)
    expect(blockedFraction).toBeLessThan(0.75)
  })
})
