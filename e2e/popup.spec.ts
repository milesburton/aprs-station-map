import { expect, test } from '@playwright/test'

const createWebSocketMock = (options: {
  stations: unknown[]
  stats: Record<string, unknown>
  onUpdateRef?: boolean
  historyPackets?: unknown[]
}) => {
  return `
    console.log('[MockWS] Init script running')

    const mockStationsData = ${JSON.stringify(options.stations)}
    const mockStatsData = ${JSON.stringify(options.stats)}
    const mockHistory = ${JSON.stringify(options.historyPackets || [])}

    // Store WebSocket instance for triggering updates
    let wsInstance = null
    ${
      options.onUpdateRef
        ? `
    window.__triggerStationUpdate = () => {
      if (wsInstance && wsInstance.onmessage) {
        wsInstance.onmessage({
          data: JSON.stringify({
            type: 'station_update',
            station: {
              callsign: 'TEST-2',
              symbol: '-',
              symbolTable: '/',
              coordinates: { latitude: 51.61, longitude: -0.21 },
              distance: 26.0,
              bearing: 91,
              lastHeard: new Date().toISOString(),
              packetCount: 4,
              comment: 'Updated station 2',
            },
          }),
        })
      }
    }
    `
        : ''
    }

    class MockWebSocket {
      constructor(url, protocols) {
        this.url = url
        this.readyState = 0
        this.onopen = null
        this.onmessage = null
        this.onclose = null
        this.onerror = null

        console.log('[MockWS] Creating WebSocket for:', url)

        if (!url.includes('/ws/spectrum')) {
          wsInstance = this
          setTimeout(() => {
            console.log('[MockWS] Firing onopen for:', url)
            this.readyState = 1
            if (this.onopen) this.onopen({ type: 'open' })

            console.log('[MockWS] Sending init message')
            if (this.onmessage) {
              this.onmessage({
                data: JSON.stringify({
                  type: 'init',
                  stations: mockStationsData,
                  stats: mockStatsData,
                }),
              })
            }

            // Send history packets if provided
            mockHistory.forEach((packet) => {
              if (this.onmessage) {
                this.onmessage({
                  data: JSON.stringify({
                    type: 'aprs_packet',
                    packet,
                  }),
                })
              }
            })
          }, 100)
        }
      }

      send(data) { console.log('[MockWS] send:', data) }
      close() { this.readyState = 3 }
      addEventListener(type, listener) {
        if (type === 'open') this.onopen = listener
        if (type === 'message') this.onmessage = listener
        if (type === 'close') this.onclose = listener
        if (type === 'error') this.onerror = listener
      }
      removeEventListener() {}
      dispatchEvent() { return true }
    }

    MockWebSocket.CONNECTING = 0
    MockWebSocket.OPEN = 1
    MockWebSocket.CLOSING = 2
    MockWebSocket.CLOSED = 3

    Object.defineProperty(window, 'WebSocket', {
      value: MockWebSocket,
      writable: true,
      configurable: true,
    })
    console.log('[MockWS] WebSocket replaced')
  `
}

test.describe('Popup Scroll Stability Tests', () => {
  // Generate mock history packets for scroll testing
  const mockHistory = Array.from({ length: 20 }, (_, i) => ({
    timestamp: new Date(Date.now() - i * 60000).toISOString(),
    source: 'TEST-1',
    destination: 'APRS',
    type: 'position',
    position: {
      latitude: 51.5 + Math.random() * 0.01,
      longitude: -0.1 + Math.random() * 0.01,
    },
    raw: `TEST-1>APRS:test packet ${i}`,
    comment: `History packet ${i}`,
  }))

  const popupStations = [
    {
      callsign: 'TEST-1',
      symbol: '-',
      symbolTable: '/',
      coordinates: { latitude: 51.5, longitude: -0.1 },
      distance: 10.5,
      bearing: 45,
      lastHeard: new Date().toISOString(),
      packetCount: 25,
      comment: 'Test station with lots of history for scroll testing',
      via: ['WIDE1-1', 'WIDE2-2', 'RELAY'],
    },
    {
      callsign: 'TEST-2',
      symbol: '-',
      symbolTable: '/',
      coordinates: { latitude: 51.6, longitude: -0.2 },
      distance: 25.3,
      bearing: 90,
      lastHeard: new Date().toISOString(),
      packetCount: 3,
      comment: 'Test station 2',
    },
  ]

  test.beforeEach(async ({ page }) => {
    // Mock API routes
    await page.route('**/api/stations', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(popupStations),
      })
    })

    await page.route('**/api/version', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ version: '1.0.0' }),
      })
    })

    // Add WebSocket mock with history and update trigger
    await page.addInitScript(
      createWebSocketMock({
        stations: popupStations,
        stats: {
          totalStations: 2,
          stationsWithPosition: 2,
          totalPackets: 28,
          kissConnected: true,
        },
        onUpdateRef: true,
        historyPackets: mockHistory,
      })
    )

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800) // Wait for history packets
  })

  test('popup should open when clicking a station marker', async ({ page }) => {
    // Wait for markers to render
    await page.waitForSelector('.station-marker', { timeout: 5000 })

    // Click on a marker
    const marker = page.locator('.station-marker').first()
    await marker.click()

    // Wait for popup to appear
    await page.waitForTimeout(300)

    // Check popup is visible
    const popup = page.locator('.leaflet-popup')
    await expect(popup).toBeVisible()
  })

  test('popup scroll position should be preserved during state updates', async ({ page }) => {
    // Wait for markers
    await page.waitForSelector('.station-marker', { timeout: 5000 })

    // Click on TEST-1 marker to open popup with history
    const marker = page.locator('.station-marker').first()
    await marker.click()
    await page.waitForTimeout(300)

    // Get the popup content area
    const popup = page.locator('.leaflet-popup-content')
    await expect(popup).toBeVisible()

    // Check if popup has scrollable content
    const scrollHeight = await popup.evaluate((el) => el.scrollHeight)
    const clientHeight = await popup.evaluate((el) => el.clientHeight)

    // If content is scrollable, test scroll preservation
    if (scrollHeight > clientHeight) {
      // Scroll down in the popup
      await popup.evaluate((el) => {
        el.scrollTop = 50
      })

      const scrollTopBefore = await popup.evaluate((el) => el.scrollTop)
      expect(scrollTopBefore).toBe(50)

      // Trigger a station update (for a DIFFERENT station)
      await page.evaluate(() => {
        // biome-ignore lint/suspicious/noExplicitAny: window extension for test
        ;(window as any).__triggerStationUpdate()
      })

      // Wait for React to process the update
      await page.waitForTimeout(200)

      // Check scroll position is preserved
      const scrollTopAfter = await popup.evaluate((el) => el.scrollTop)
      expect(scrollTopAfter).toBe(scrollTopBefore)
    }
  })

  test('popup should remain open when other stations update', async ({ page }) => {
    // Wait for markers
    await page.waitForSelector('.station-marker', { timeout: 5000 })

    // Click on TEST-1 marker
    const marker = page.locator('.station-marker').first()
    await marker.click()
    await page.waitForTimeout(300)

    const popup = page.locator('.leaflet-popup')
    await expect(popup).toBeVisible()

    // Get popup content to verify it's for TEST-1
    const popupText = await popup.textContent()
    expect(popupText).toContain('TEST-1')

    // Trigger update for TEST-2
    await page.evaluate(() => {
      // biome-ignore lint/suspicious/noExplicitAny: window extension for test
      ;(window as any).__triggerStationUpdate()
    })
    await page.waitForTimeout(200)

    // Popup should still be visible and showing TEST-1
    await expect(popup).toBeVisible()
    const popupTextAfter = await popup.textContent()
    expect(popupTextAfter).toContain('TEST-1')
  })
})
