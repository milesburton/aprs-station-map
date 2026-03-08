import { expect, test } from '@playwright/test'
import { type MockPacket, type MockStation, type MockStats, setupWsMock } from './helpers'

const historyPackets: MockPacket[] = Array.from({ length: 20 }, (_, i) => ({
  timestamp: new Date(Date.now() - i * 60000).toISOString(),
  source: 'TEST-1',
  destination: 'APRS',
  raw: `TEST-1>APRS:test packet ${i}`,
  position: { latitude: 51.5 + i * 0.001, longitude: -0.1 + i * 0.001 },
}))

const stationWithHistory: MockStation = {
  callsign: 'TEST-1',
  symbol: '-',
  symbolTable: '/',
  coordinates: { latitude: 51.5, longitude: -0.1 },
  distance: 10.5,
  bearing: 45,
  lastHeard: new Date().toISOString(),
  packetCount: 25,
  comment: 'Test station Alpha',
  via: ['WIDE1-1', 'WIDE2-2'],
}

const stationNoHistory: MockStation = {
  callsign: 'TEST-2',
  symbol: '>',
  symbolTable: '/',
  coordinates: { latitude: 51.6, longitude: -0.2 },
  distance: 25.3,
  bearing: 90,
  lastHeard: new Date().toISOString(),
  packetCount: 3,
  comment: 'Mobile station',
}

const stats: MockStats = {
  totalStations: 2,
  stationsWithPosition: 2,
  totalPackets: 28,
  kissConnected: true,
}

// For popup content tests use only TEST-1 so we always click the right marker
test.describe('Station popup — content', () => {
  test.beforeEach(async ({ page }) => {
    await setupWsMock(
      page,
      [stationWithHistory],
      { ...stats, totalStations: 1 },
      {
        stationHistory: { 'TEST-1': historyPackets },
      }
    )
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.station-marker', { timeout: 5000 })
    await page.locator('.station-marker').first().click()
    await expect(page.locator('.leaflet-popup')).toBeVisible()
  })

  test('shows callsign', async ({ page }) => {
    await expect(page.locator('.leaflet-popup')).toContainText('TEST-1')
  })

  test('shows station comment', async ({ page }) => {
    await expect(page.locator('.leaflet-popup')).toContainText('Test station Alpha')
  })

  test('shows position coordinates', async ({ page }) => {
    await expect(page.locator('.leaflet-popup')).toContainText('51.5000')
    await expect(page.locator('.leaflet-popup')).toContainText('-0.1000')
  })

  test('shows packet count', async ({ page }) => {
    await expect(page.locator('.leaflet-popup')).toContainText('25')
  })

  test('shows via path', async ({ page }) => {
    await expect(page.locator('.leaflet-popup')).toContainText('WIDE1-1')
  })

  test('shows recent activity when history is present', async ({ page }) => {
    await expect(page.locator('.leaflet-popup')).toContainText('Recent Activity')
  })

  test('shows Follow button', async ({ page }) => {
    await expect(page.locator('.leaflet-popup .follow-btn')).toBeVisible()
  })
})

// For stability tests we need two stations so TEST-2 can trigger an update
test.describe('Station popup — stability', () => {
  test.beforeEach(async ({ page }) => {
    await setupWsMock(page, [stationWithHistory, stationNoHistory], stats, {
      stationHistory: { 'TEST-1': historyPackets },
      triggerUpdateStation: {
        ...stationNoHistory,
        packetCount: 4,
        comment: 'Updated mobile station',
        lastHeard: new Date().toISOString(),
      },
    })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.station-marker', { timeout: 5000 })
    await page.waitForTimeout(300)
  })

  test('popup remains open when a different station receives an update', async ({ page }) => {
    // Click each marker until we find TEST-1's popup
    const markers = page.locator('.station-marker')
    const count = await markers.count()
    let found = false
    for (let i = 0; i < count; i++) {
      await markers.nth(i).click()
      await page.waitForTimeout(150)
      const text = await page
        .locator('.leaflet-popup')
        .textContent()
        .catch(() => '')
      if (text?.includes('TEST-1')) {
        found = true
        break
      }
    }
    expect(found).toBe(true)

    const popup = page.locator('.leaflet-popup')
    await page.evaluate(() => {
      ;(window as unknown as Record<string, unknown>).__triggerUpdate?.()
    })
    await page.waitForTimeout(200)

    await expect(popup).toBeVisible()
    await expect(popup).toContainText('TEST-1')
  })

  test('scroll position preserved when another station updates', async ({ page }) => {
    const markers = page.locator('.station-marker')
    const count = await markers.count()
    for (let i = 0; i < count; i++) {
      await markers.nth(i).click()
      await page.waitForTimeout(150)
      const text = await page
        .locator('.leaflet-popup')
        .textContent()
        .catch(() => '')
      if (text?.includes('TEST-1')) break
    }

    const content = page.locator('.leaflet-popup-content')
    await expect(content).toBeVisible()
    const scrollHeight = await content.evaluate((el) => el.scrollHeight)
    const clientHeight = await content.evaluate((el) => el.clientHeight)

    if (scrollHeight > clientHeight) {
      await content.evaluate((el) => {
        el.scrollTop = 50
      })
      expect(await content.evaluate((el) => el.scrollTop)).toBe(50)

      await page.evaluate(() => {
        ;(window as unknown as Record<string, unknown>).__triggerUpdate?.()
      })
      await page.waitForTimeout(200)

      expect(await content.evaluate((el) => el.scrollTop)).toBe(50)
    }
  })
})
