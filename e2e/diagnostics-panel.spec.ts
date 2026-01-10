import { expect, test } from '@playwright/test'

const mockStations = [
  {
    callsign: 'TEST-1',
    latitude: 51.5,
    longitude: -0.1,
    distance: 10.5,
    lastHeard: new Date().toISOString(),
  },
  {
    callsign: 'TEST-2',
    latitude: 51.6,
    longitude: -0.2,
    distance: 25.3,
    lastHeard: new Date().toISOString(),
  },
  {
    callsign: 'FAR-STATION',
    latitude: 52.0,
    longitude: 1.0,
    distance: 145.7,
    lastHeard: new Date().toISOString(),
  },
]

test.describe('Diagnostics Panel Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/stations', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockStations),
      })
    })

    await page.route('**/api/version', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ version: '1.0.0', buildDate: '2026-01-01T00:00:00Z' }),
      })
    })

    await page.addInitScript(() => {
      const mockStats = {
        totalStations: 3,
        stationsWithPosition: 3,
        totalPackets: 46,
        kissConnected: true,
      }

      const mockPackets = [
        {
          timestamp: new Date().toISOString(),
          source: 'TEST-1',
          destination: 'APRS',
          path: 'WIDE1-1,WIDE2-2',
          raw: 'TEST-1>APRS,WIDE1-1,WIDE2-2:!5130.00N/00006.00W-PHG2360/Test station',
          comment: 'Test station',
        },
        {
          timestamp: new Date(Date.now() - 60000).toISOString(),
          source: 'TEST-2',
          destination: 'APRS',
          path: 'WIDE1-1',
          raw: 'TEST-2>APRS,WIDE1-1:@092345z5136.00N/00012.00W_090/000g005t042',
          comment: 'Weather station',
        },
      ]

      class MockWebSocket {
        onopen: (() => void) | null = null
        onmessage: ((event: { data: string }) => void) | null = null
        onclose: (() => void) | null = null
        onerror: (() => void) | null = null
        readyState = 1

        constructor() {
          setTimeout(() => {
            this.onopen?.()
            this.onmessage?.({ data: JSON.stringify({ type: 'stats', data: mockStats }) })
            mockPackets.forEach((packet) => {
              this.onmessage?.({ data: JSON.stringify({ type: 'packet', data: packet }) })
            })
          }, 100)
        }

        send() {}
        close() {}
      }
      ;(window as unknown as { WebSocket: typeof MockWebSocket }).WebSocket =
        MockWebSocket as unknown as typeof WebSocket
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
  })

  test('Stats tab visual snapshot', async ({ page }) => {
    const panel = page.locator('[class*="bg-slate-800"][class*="border-t-2"]')
    await panel.locator('button:has-text("Show")').click()
    await page.waitForTimeout(300)

    await expect(panel).toHaveScreenshot('stats-tab.png')
  })

  test('Packets tab visual snapshot', async ({ page }) => {
    const panel = page.locator('[class*="bg-slate-800"][class*="border-t-2"]')
    await panel.locator('button:has-text("Show")').click()
    await page.waitForTimeout(300)

    await page.getByRole('button', { name: 'Packets', exact: true }).click()
    await page.waitForTimeout(300)

    await expect(panel).toHaveScreenshot('packets-tab.png')
  })

  test('Spectrum tab visual snapshot', async ({ page }) => {
    const panel = page.locator('[class*="bg-slate-800"][class*="border-t-2"]')
    await panel.locator('button:has-text("Show")').click()
    await page.waitForTimeout(300)

    await panel.locator('button:has-text("Spectrum")').click()
    await page.waitForTimeout(300)

    await expect(panel).toHaveScreenshot('spectrum-tab.png')
  })

  test('Status tab visual snapshot', async ({ page }) => {
    const panel = page.locator('[class*="bg-slate-800"][class*="border-t-2"]')
    await panel.locator('button:has-text("Show")').click()
    await page.waitForTimeout(300)

    await panel.locator('button:has-text("Status")').click()
    await page.waitForTimeout(300)

    await expect(panel).toHaveScreenshot('status-tab.png')
  })

  test('About tab visual snapshot', async ({ page }) => {
    const panel = page.locator('[class*="bg-slate-800"][class*="border-t-2"]')
    await panel.locator('button:has-text("Show")').click()
    await page.waitForTimeout(300)

    await panel.locator('button:has-text("About")').click()
    await page.waitForTimeout(300)

    await expect(panel).toHaveScreenshot('about-tab.png')
  })

  test('Panel collapsed state visual snapshot', async ({ page }) => {
    const panel = page.locator('[class*="bg-slate-800"][class*="border-t-2"]')
    await expect(panel).toHaveScreenshot('panel-collapsed.png')
  })
})
