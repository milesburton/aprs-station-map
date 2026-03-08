import { expect, test } from '@playwright/test'

const mockStations = [
  {
    callsign: 'G4ABC',
    symbol: '-',
    symbolTable: '/',
    coordinates: { latitude: 51.5, longitude: -0.1 },
    distance: 10.5,
    bearing: 45,
    lastHeard: new Date().toISOString(),
    packetCount: 5,
    comment: 'Test station Alpha',
    via: ['WIDE1-1', 'WIDE2-1'],
  },
  {
    callsign: 'M0XYZ',
    symbol: '>',
    symbolTable: '/',
    coordinates: { latitude: 51.6, longitude: -0.2 },
    distance: 25.3,
    bearing: 90,
    lastHeard: new Date(Date.now() - 120000).toISOString(),
    packetCount: 2,
    comment: 'Mobile station',
    via: ['WIDE1-1'],
  },
  {
    callsign: 'MB7UEL',
    symbol: '-',
    symbolTable: '/',
    coordinates: null,
    distance: null,
    bearing: null,
    lastHeard: new Date(Date.now() - 300000).toISOString(),
    packetCount: 1,
    comment: 'No position',
    via: [],
  },
]

const mockStats = {
  totalStations: 3,
  stationsWithPosition: 2,
  totalPackets: 8,
  kissConnected: false,
}

const setupMocks = async (page: import('@playwright/test').Page) => {
  await page.addInitScript(
    ([stations, stats]) => {
      class MockWebSocket {
        onopen: ((e: Event) => void) | null = null
        onmessage: ((e: { data: string }) => void) | null = null
        onclose: (() => void) | null = null
        onerror: (() => void) | null = null
        readyState = 0

        constructor(url: string) {
          if (url.includes('/ws/spectrum')) return
          setTimeout(() => {
            this.readyState = 1
            this.onopen?.({ type: 'open' } as Event)
            this.onmessage?.({
              data: JSON.stringify({ type: 'init', stations, stats }),
            })
          }, 100)
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
    [mockStations, mockStats]
  )

  await page.route('**/api/version', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ version: '1.0.0', buildTime: '2026-01-01T00:00:00Z' }),
    })
  )
}

test.describe('Station list and filtering', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)
  })

  test('shows all stations in the diagnostics panel', async ({ page }) => {
    const panel = page.locator('[class*="bg-slate-"]').first()
    await panel.locator('button:has-text("▲")').click()
    await page.waitForTimeout(300)

    const statsText = await page.locator('body').textContent()
    expect(statsText).toContain('G4ABC')
    expect(statsText).toContain('M0XYZ')
  })

  test('station markers appear on map for positioned stations', async ({ page }) => {
    await page.waitForSelector('.station-marker', { timeout: 5000 })
    const markers = page.locator('.station-marker')
    await expect(markers).toHaveCount(2)
  })

  test('stats panel shows correct totals', async ({ page }) => {
    const panel = page.locator('[class*="bg-slate-"]').first()
    await panel.locator('button:has-text("▲")').click()
    await page.waitForTimeout(300)

    const bodyText = await page.locator('body').textContent()
    expect(bodyText).toContain('3')
  })
})

test.describe('URL state persistence', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page)
  })

  test('page loads successfully at root URL', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL('/')
    await expect(page.locator('#map')).toBeVisible()
  })

  test('map element is present and rendered', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)
    const map = page.locator('.leaflet-container')
    await expect(map).toBeVisible()
  })
})
