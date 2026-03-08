import type { Page } from '@playwright/test'

export interface MockStation {
  callsign: string
  symbol: string
  symbolTable: string
  coordinates: { latitude: number; longitude: number } | null
  distance: number | null
  bearing: number | null
  lastHeard: string
  packetCount: number
  comment?: string
  via?: string[]
}

export interface MockStats {
  totalStations: number
  stationsWithPosition: number
  totalPackets: number
  kissConnected: boolean
}

export interface MockPacket {
  timestamp: string
  source: string
  destination: string
  path?: string
  raw: string
  comment?: string
  position?: { latitude: number; longitude: number }
}

/**
 * Injects a mock WebSocket that sends an `init` message followed by optional
 * extra messages via the returned `sendMessage` helper.  A global
 * `window.__wsSend(msg)` is also exposed so tests can push messages from the
 * page context.
 */
export const setupWsMock = async (
  page: Page,
  stations: MockStation[],
  stats: MockStats,
  extra?: {
    packets?: MockPacket[]
    triggerUpdateStation?: MockStation
    stationHistory?: Record<string, MockPacket[]>
  }
) => {
  await page.addInitScript(
    ({ stations, stats, packets, triggerStation, stationHistory }) => {
      let wsInstance: {
        onopen: ((e: Event) => void) | null
        onmessage: ((e: { data: string }) => void) | null
        readyState: number
      } | null = null

      const send = (msg: unknown) => {
        if (wsInstance?.onmessage) {
          wsInstance.onmessage({ data: JSON.stringify(msg) })
        }
      }

      // Expose helper so tests can push arbitrary WS messages
      ;(window as unknown as Record<string, unknown>).__wsSend = send

      if (triggerStation) {
        ;(window as unknown as Record<string, unknown>).__triggerUpdate = () =>
          send({ type: 'station_update', station: triggerStation })
      }

      class MockWebSocket {
        onopen: ((e: Event) => void) | null = null
        onmessage: ((e: { data: string }) => void) | null = null
        onclose: (() => void) | null = null
        onerror: (() => void) | null = null
        readyState = 0

        constructor(url: string) {
          if (url.includes('/ws/spectrum')) return
          wsInstance = this
          setTimeout(() => {
            this.readyState = 1
            this.onopen?.({ type: 'open' } as Event)
            this.onmessage?.({
              data: JSON.stringify({ type: 'init', stations, stats, stationHistory }),
            })
            for (const pkt of packets ?? []) {
              this.onmessage?.({ data: JSON.stringify({ type: 'aprs_packet', packet: pkt }) })
            }
          }, 50)
        }

        send() {}
        close() {
          this.readyState = 3
        }
        addEventListener(type: string, listener: (...args: unknown[]) => void) {
          if (type === 'open') this.onopen = listener as (e: Event) => void
          if (type === 'message') this.onmessage = listener as (e: { data: string }) => void
          if (type === 'close') this.onclose = listener as () => void
          if (type === 'error') this.onerror = listener as () => void
        }
        removeEventListener() {}
        dispatchEvent() {
          return true
        }

        static CONNECTING = 0
        static OPEN = 1
        static CLOSING = 2
        static CLOSED = 3
      }

      Object.defineProperty(window, 'WebSocket', {
        value: MockWebSocket,
        writable: true,
        configurable: true,
      })
    },
    {
      stations,
      stats,
      packets: extra?.packets ?? [],
      triggerStation: extra?.triggerUpdateStation ?? null,
      stationHistory: extra?.stationHistory ?? {},
    }
  )

  await page.route('**/api/version', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ version: '1.0.0', buildTime: '2026-01-01T00:00:00Z' }),
    })
  )
}

export const openDiagnosticsPanel = async (page: Page) => {
  await page.locator('.diag-collapse-btn').click()
  await page.waitForTimeout(200)
}
