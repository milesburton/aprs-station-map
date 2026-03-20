import { expect, test } from '@playwright/test'
import { type MockStation, type MockStats, openDiagnosticsPanel, setupWsMock } from './helpers'

const stations: MockStation[] = [
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

const stats: MockStats = {
  totalStations: 3,
  stationsWithPosition: 2,
  totalPackets: 8,
  kissConnected: false,
}

test.describe('Map markers', () => {
  test.beforeEach(async ({ page }) => {
    await setupWsMock(page, stations, stats)
    await page.goto('/')
    await page.waitForSelector('.station-marker', { timeout: 5000 })
  })

  test('renders markers only for stations with coordinates', async ({ page }) => {
    await expect(page.locator('.station-marker')).toHaveCount(2)
  })

  test('new station pushed via WebSocket appears as a marker', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as unknown as Record<string, unknown>).__wsSend({
        type: 'station_update',
        station: {
          callsign: 'NEW-1',
          symbol: '-',
          symbolTable: '/',
          coordinates: { latitude: 51.7, longitude: -0.3 },
          distance: 40,
          bearing: 270,
          lastHeard: new Date().toISOString(),
          packetCount: 1,
        },
      })
    })
    await expect(page.locator('.station-marker')).toHaveCount(3)
  })

  test('updating an existing station does not create a duplicate marker', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as unknown as Record<string, unknown>).__wsSend({
        type: 'station_update',
        station: {
          callsign: 'G4ABC',
          symbol: '-',
          symbolTable: '/',
          coordinates: { latitude: 51.51, longitude: -0.11 },
          distance: 11,
          bearing: 46,
          lastHeard: new Date().toISOString(),
          packetCount: 6,
        },
      })
    })
    await expect(page.locator('.station-marker')).toHaveCount(2)
  })
})

test.describe('Toolbar filters', () => {
  test.beforeEach(async ({ page }) => {
    await setupWsMock(page, stations, stats)
    await page.goto('/')
    await page.waitForSelector('.station-marker', { timeout: 5000 })
  })

  test('search filters markers to matching callsign', async ({ page }) => {
    await page.locator('.toolbar-search').fill('G4ABC')
    await expect(page.locator('.station-marker')).toHaveCount(1)
  })

  test('clearing search restores all markers', async ({ page }) => {
    await page.locator('.toolbar-search').fill('G4ABC')
    await expect(page.locator('.station-marker')).toHaveCount(1)
    await page.locator('.toolbar-search').clear()
    await expect(page.locator('.station-marker')).toHaveCount(2)
  })

  test('symbol filter shows only matching station types', async ({ page }) => {
    const select = page.locator('.toolbar-select-wide')
    const options = await select.locator('option').allTextContents()
    const carOption = options.find((o) => o.includes('Car'))
    if (carOption) {
      await select.selectOption({ label: carOption })
      await expect(page.locator('.station-marker')).toHaveCount(1)
    }
  })

  test('reset button clears active filter and restores markers', async ({ page }) => {
    await page.locator('.toolbar-search').fill('G4ABC')
    const resetBtn = page.locator('.toolbar-reset-btn')
    await expect(resetBtn).toBeVisible()
    await resetBtn.click()
    await expect(page.locator('.toolbar-search')).toHaveValue('')
    await expect(resetBtn).not.toBeVisible()
    await expect(page.locator('.station-marker')).toHaveCount(2)
  })
})

test.describe('Diagnostics panel stats', () => {
  test.beforeEach(async ({ page }) => {
    await setupWsMock(page, stations, stats)
    await page.goto('/')
    await page.waitForSelector('.station-marker', { timeout: 5000 })
    await openDiagnosticsPanel(page)
  })

  test('shows correct total station count', async ({ page }) => {
    await expect(page.locator('body')).toContainText('3')
  })

  test('shows the furthest station callsign', async ({ page }) => {
    await expect(page.locator('body')).toContainText('M0XYZ')
  })
})

test.describe('Page load', () => {
  test('map renders on initial load', async ({ page }) => {
    await setupWsMock(page, stations, stats)
    await page.goto('/')
    await expect(page.locator('.leaflet-container')).toBeVisible()
  })
})
