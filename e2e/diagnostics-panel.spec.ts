import { expect, test } from '@playwright/test'
import { type MockStation, type MockStats, openDiagnosticsPanel, setupWsMock } from './helpers'

const stations: MockStation[] = [
  {
    callsign: 'TEST-1',
    symbol: '-',
    symbolTable: '/',
    coordinates: { latitude: 51.5, longitude: -0.1 },
    distance: 10.5,
    bearing: 45,
    lastHeard: new Date().toISOString(),
    packetCount: 30,
    comment: 'Test station',
  },
  {
    callsign: 'TEST-2',
    symbol: '>',
    symbolTable: '/',
    coordinates: { latitude: 51.6, longitude: -0.2 },
    distance: 25.3,
    bearing: 90,
    lastHeard: new Date().toISOString(),
    packetCount: 16,
    comment: 'Weather station',
  },
  {
    callsign: 'FAR-1',
    symbol: '-',
    symbolTable: '/',
    coordinates: { latitude: 52.0, longitude: 1.0 },
    distance: 145.7,
    bearing: 45,
    lastHeard: new Date().toISOString(),
    packetCount: 5,
  },
]

const stats: MockStats = {
  totalStations: 3,
  stationsWithPosition: 3,
  totalPackets: 46,
  kissConnected: true,
}

const packets = [
  {
    timestamp: new Date().toISOString(),
    source: 'TEST-1',
    destination: 'APRS',
    path: 'WIDE1-1,WIDE2-2',
    raw: 'TEST-1>APRS,WIDE1-1,WIDE2-2:!5130.00N/00006.00W-Test station',
    comment: 'Test station',
    position: { latitude: 51.5, longitude: -0.1 },
  },
  {
    timestamp: new Date(Date.now() - 60000).toISOString(),
    source: 'TEST-2',
    destination: 'APRS',
    path: 'WIDE1-1',
    raw: 'TEST-2>APRS,WIDE1-1:@092345z5136.00N/00012.00W_090/000g005t042',
    comment: 'Weather station',
    position: { latitude: 51.6, longitude: -0.2 },
  },
]

test.describe('Diagnostics panel — collapse/expand', () => {
  test.beforeEach(async ({ page }) => {
    await setupWsMock(page, stations, stats, { packets })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)
  })

  test('panel starts collapsed', async ({ page }) => {
    await expect(page.locator('.diag-collapse-btn')).toContainText('▲')
  })

  test('panel expands when collapse button is clicked', async ({ page }) => {
    await openDiagnosticsPanel(page)
    await expect(page.locator('[role="tablist"]')).toBeVisible()
  })

  test('panel collapses again when button clicked a second time', async ({ page }) => {
    await openDiagnosticsPanel(page)
    await page.locator('.diag-collapse-btn').click()
    await expect(page.locator('[role="tablist"]')).not.toBeVisible()
  })

  test('collapsed panel shows station count', async ({ page }) => {
    await expect(page.locator('.diag-station-count')).toBeVisible()
  })
})

test.describe('Diagnostics panel — status indicator', () => {
  test('shows green indicator when KISS connected', async ({ page }) => {
    await setupWsMock(page, stations, { ...stats, kissConnected: true }, { packets })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)
    await expect(page.locator('.diag-status-indicator')).toContainText('🟢')
  })

  test('shows yellow indicator when KISS disconnected but WS connected', async ({ page }) => {
    await setupWsMock(page, stations, { ...stats, kissConnected: false }, { packets })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)
    await expect(page.locator('.diag-status-indicator')).toContainText('🟡')
  })
})

test.describe('Diagnostics panel — Stats tab', () => {
  test.beforeEach(async ({ page }) => {
    await setupWsMock(page, stations, stats, { packets })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)
    await openDiagnosticsPanel(page)
  })

  test('shows total station count', async ({ page }) => {
    await expect(page.locator('[role="tabpanel"]')).toContainText('3')
  })

  test('shows the furthest station callsign', async ({ page }) => {
    await expect(page.locator('[role="tabpanel"]')).toContainText('FAR-1')
  })

  test('shows a Refresh button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Refresh/i })).toBeVisible()
  })

  test('visual snapshot — Stats tab', async ({ page }) => {
    await expect(page.locator('[role="tabpanel"]')).toHaveScreenshot('stats-tab.png')
  })
})

test.describe('Diagnostics panel — Packets tab', () => {
  test.beforeEach(async ({ page }) => {
    await setupWsMock(page, stations, stats, { packets })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)
    await openDiagnosticsPanel(page)
    await page.getByRole('tab', { name: 'Packets' }).click()
    await page.waitForTimeout(200)
  })

  test('shows packet sources in the list', async ({ page }) => {
    await expect(page.locator('[role="tabpanel"]')).toContainText('TEST-1')
    await expect(page.locator('[role="tabpanel"]')).toContainText('TEST-2')
  })

  test('shows raw packet destination', async ({ page }) => {
    await expect(page.locator('[role="tabpanel"]')).toContainText('APRS')
  })

  test('visual snapshot — Packets tab', async ({ page }) => {
    await expect(page.locator('[role="tabpanel"]')).toHaveScreenshot('packets-tab.png', {
      mask: [page.locator('.history-time'), page.getByText(/ago/)],
    })
  })
})

test.describe('Diagnostics panel — Status tab', () => {
  test.beforeEach(async ({ page }) => {
    await setupWsMock(page, stations, stats, { packets })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)
    await openDiagnosticsPanel(page)
    await page.getByRole('tab', { name: 'Status' }).click()
    await page.waitForTimeout(200)
  })

  test('shows WebSocket connected status', async ({ page }) => {
    await expect(page.locator('[role="tabpanel"]')).toContainText('Connected')
  })

  test('shows total packets count', async ({ page }) => {
    await expect(page.locator('[role="tabpanel"]')).toContainText('46')
  })

  test('visual snapshot — Status tab', async ({ page }) => {
    await expect(page.locator('[role="tabpanel"]')).toHaveScreenshot('status-tab.png')
  })
})

test.describe('Diagnostics panel — About tab', () => {
  test.beforeEach(async ({ page }) => {
    await setupWsMock(page, stations, stats, { packets })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)
    await openDiagnosticsPanel(page)
    await page.getByRole('tab', { name: 'About' }).click()
    await page.waitForTimeout(200)
  })

  test('shows frequency information', async ({ page }) => {
    await expect(page.locator('[role="tabpanel"]')).toContainText('144.800')
  })

  test('shows client version', async ({ page }) => {
    await expect(page.locator('[role="tabpanel"]')).toContainText('1.')
  })

  test('visual snapshot — About tab', async ({ page }) => {
    await expect(page.locator('[role="tabpanel"]')).toHaveScreenshot('about-tab.png', {
      mask: [page.getByText(/^\d{1,2}\/\d{1,2}\/\d{4}/)],
    })
  })
})

test.describe('Diagnostics panel — Spectrum tab', () => {
  test.beforeEach(async ({ page }) => {
    await setupWsMock(page, stations, stats, { packets })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)
    await openDiagnosticsPanel(page)
    await page.getByRole('tab', { name: 'Spectrum' }).click()
    await page.waitForTimeout(200)
  })

  test('Spectrum tab content is visible', async ({ page }) => {
    await expect(page.locator('[role="tabpanel"]')).toBeVisible()
  })

  test('visual snapshot — Spectrum tab', async ({ page }) => {
    await expect(page.locator('[role="tabpanel"]')).toHaveScreenshot('spectrum-tab.png')
  })
})

test.describe('Diagnostics panel — collapsed visual', () => {
  test('visual snapshot — panel collapsed', async ({ page }) => {
    await setupWsMock(page, stations, stats, { packets })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)
    const panel = page.locator('[class*="bg-slate-900"][class*="border-t"]').first()
    await expect(panel).toHaveScreenshot('panel-collapsed.png')
  })
})
