import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import {
  type MockPacket,
  type MockStation,
  type MockStats,
  openDiagnosticsPanel,
  setupWsMock,
} from './helpers'

/**
 * Screenshot generation tests — produces hero images for README.md.
 * Uses rich mock data and intercepted map tiles for deterministic output.
 */

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SCREENSHOT_DIR = path.resolve(__dirname, '../docs/screenshots')

// --- Realistic station fixtures around London / SE England ---

const now = new Date()
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString()

const stations: MockStation[] = [
  // Infrastructure
  {
    callsign: 'MB7UNR',
    symbol: '#',
    symbolTable: '/',
    coordinates: { latitude: 51.508, longitude: -0.076 },
    distance: 8.2,
    bearing: 315,
    lastHeard: minutesAgo(2),
    packetCount: 482,
    comment: 'London Bridge Digipeater',
    via: [],
  },
  {
    callsign: 'GB7IC',
    symbol: '&',
    symbolTable: '/',
    coordinates: { latitude: 51.4988, longitude: -0.1749 },
    distance: 12.1,
    bearing: 270,
    lastHeard: minutesAgo(5),
    packetCount: 1203,
    comment: 'iGate London West',
    via: [],
  },
  {
    callsign: 'MB7UEL',
    symbol: '#',
    symbolTable: '/',
    coordinates: { latitude: 51.456, longitude: 0.053 },
    distance: 4.5,
    bearing: 120,
    lastHeard: minutesAgo(1),
    packetCount: 891,
    comment: 'Eltham Digipeater',
    via: [],
  },
  // Vehicles
  {
    callsign: 'M0LHA-9',
    symbol: '>',
    symbolTable: '/',
    coordinates: { latitude: 51.475, longitude: -0.001 },
    distance: 6.3,
    bearing: 350,
    lastHeard: minutesAgo(0),
    packetCount: 47,
    comment: '/A=00085 13.8V',
    via: ['MB7UEL', 'WIDE1-1'],
  },
  {
    callsign: 'G4PRS-9',
    symbol: '>',
    symbolTable: '/',
    coordinates: { latitude: 51.531, longitude: -0.124 },
    distance: 15.7,
    bearing: 330,
    lastHeard: minutesAgo(3),
    packetCount: 22,
    comment: 'In transit via A2',
    via: ['MB7UNR', 'WIDE2-1'],
  },
  {
    callsign: 'G0TRK-12',
    symbol: 'k',
    symbolTable: '/',
    coordinates: { latitude: 51.381, longitude: 0.273 },
    distance: 32.1,
    bearing: 105,
    lastHeard: minutesAgo(8),
    packetCount: 15,
    comment: 'Delivery route Kent',
    via: ['WIDE1-1', 'WIDE2-2'],
  },
  {
    callsign: 'M6CYC-7',
    symbol: 'b',
    symbolTable: '/',
    coordinates: { latitude: 51.47, longitude: 0.005 },
    distance: 5.8,
    bearing: 10,
    lastHeard: minutesAgo(12),
    packetCount: 8,
    comment: 'Cycling Greenwich Park',
    via: ['MB7UEL'],
  },
  // Weather stations
  {
    callsign: 'G3WXR',
    symbol: '_',
    symbolTable: '/',
    coordinates: { latitude: 51.404, longitude: -0.29 },
    distance: 28.4,
    bearing: 240,
    lastHeard: minutesAgo(4),
    packetCount: 356,
    comment: '220/003g008t048r000p005P003h82b10145',
    via: [],
  },
  {
    callsign: 'M0WET-13',
    symbol: '_',
    symbolTable: '/',
    coordinates: { latitude: 51.59, longitude: 0.18 },
    distance: 18.9,
    bearing: 25,
    lastHeard: minutesAgo(6),
    packetCount: 198,
    comment: '180/005g010t051r000p002h78b10152',
    via: [],
  },
  // Home stations
  {
    callsign: 'G7HAM',
    symbol: '-',
    symbolTable: '/',
    coordinates: { latitude: 51.384, longitude: -0.135 },
    distance: 19.2,
    bearing: 210,
    lastHeard: minutesAgo(15),
    packetCount: 67,
    comment: 'QTH Croydon 73!',
    via: ['WIDE1-1'],
  },
  {
    callsign: '2E0KIT',
    symbol: '-',
    symbolTable: '/',
    coordinates: { latitude: 51.57, longitude: -0.34 },
    distance: 30.5,
    bearing: 295,
    lastHeard: minutesAgo(20),
    packetCount: 31,
    comment: 'Foundation station NW London',
    via: ['GB7IC', 'WIDE2-1'],
  },
  {
    callsign: 'G4ABC-5',
    symbol: 'l',
    symbolTable: '/',
    coordinates: { latitude: 51.52, longitude: 0.08 },
    distance: 10.3,
    bearing: 45,
    lastHeard: minutesAgo(7),
    packetCount: 19,
    comment: 'APRS Messenger',
    via: ['MB7UEL'],
  },
  // Aircraft
  {
    callsign: 'G-INFO',
    symbol: "'",
    symbolTable: '/',
    coordinates: { latitude: 51.62, longitude: -0.22 },
    distance: 25.0,
    bearing: 335,
    lastHeard: minutesAgo(9),
    packetCount: 5,
    comment: '/A=02500 Enroute Elstree',
    via: ['WIDE1-1', 'WIDE2-2'],
  },
  // Maritime
  {
    callsign: 'MMSI123',
    symbol: 's',
    symbolTable: '/',
    coordinates: { latitude: 51.505, longitude: 0.055 },
    distance: 8.0,
    bearing: 60,
    lastHeard: minutesAgo(11),
    packetCount: 12,
    comment: 'Thames Clipper',
    via: [],
  },
  // Distant station
  {
    callsign: 'F4DX',
    symbol: '-',
    symbolTable: '/',
    coordinates: { latitude: 50.85, longitude: 1.58 },
    distance: 142.3,
    bearing: 148,
    lastHeard: minutesAgo(25),
    packetCount: 3,
    comment: 'Calais 73 de F4DX',
    via: ['WIDE1-1', 'WIDE2-2'],
  },
]

const stats: MockStats = {
  totalStations: stations.length,
  stationsWithPosition: stations.length,
  totalPackets: stations.reduce((sum, s) => sum + s.packetCount, 0),
  kissConnected: true,
}

const packets: MockPacket[] = [
  {
    timestamp: minutesAgo(0),
    source: 'M0LHA-9',
    destination: 'APRS',
    path: 'MB7UEL,WIDE1-1',
    raw: 'M0LHA-9>APRS,MB7UEL,WIDE1-1:!5128.50N/00000.06W>/A=00085 13.8V',
    comment: '/A=00085 13.8V',
    position: { latitude: 51.475, longitude: -0.001 },
  },
  {
    timestamp: minutesAgo(1),
    source: 'MB7UEL',
    destination: 'APRS',
    raw: 'MB7UEL>APRS:!5127.36N/00003.18E#Eltham Digipeater',
    comment: 'Eltham Digipeater',
    position: { latitude: 51.456, longitude: 0.053 },
  },
  {
    timestamp: minutesAgo(2),
    source: 'MB7UNR',
    destination: 'APRS',
    raw: 'MB7UNR>APRS:!5130.48N/00004.56W#London Bridge Digipeater',
    comment: 'London Bridge Digipeater',
    position: { latitude: 51.508, longitude: -0.076 },
  },
  {
    timestamp: minutesAgo(3),
    source: 'G4PRS-9',
    destination: 'APRS',
    path: 'MB7UNR,WIDE2-1',
    raw: 'G4PRS-9>APRS,MB7UNR,WIDE2-1:!5131.86N/00007.44W>In transit via A2',
    comment: 'In transit via A2',
    position: { latitude: 51.531, longitude: -0.124 },
  },
  {
    timestamp: minutesAgo(4),
    source: 'G3WXR',
    destination: 'APRS',
    raw: 'G3WXR>APRS:@092345z5124.24N/00017.40W_220/003g008t048r000p005P003h82b10145',
    comment: '220/003g008t048r000p005P003h82b10145',
    position: { latitude: 51.404, longitude: -0.29 },
  },
]

// Trail history for the mobile station
const mobileHistory: MockPacket[] = Array.from({ length: 10 }, (_, i) => ({
  timestamp: minutesAgo(i * 3),
  source: 'M0LHA-9',
  destination: 'APRS',
  raw: `M0LHA-9>APRS:!pos${i}`,
  position: {
    latitude: 51.475 - i * 0.004,
    longitude: -0.001 - i * 0.006,
  },
}))

// --- Tile interception: serve a light gray tile for deterministic maps ---

const BLANK_TILE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADPMOyrAAAAG0lEQVR4nO3BAQEAAACCIP+vbkhA' +
    'AAAAAAAAAHcGEQAAAQ8ZywAAAABJRU5ErkJggg==',
  'base64'
)

async function interceptTiles(page: import('@playwright/test').Page) {
  await page.route('**/*.tile.openstreetmap.org/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: BLANK_TILE_PNG,
    })
  )
}

async function saveScreenshot(page: import('@playwright/test').Page, name: string) {
  const buffer = await page.screenshot({ type: 'png' })
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  fs.writeFileSync(path.join(SCREENSHOT_DIR, name), buffer)
}

// --- Screenshot tests ---

test.describe('README screenshots', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test.beforeEach(async ({ page }) => {
    await interceptTiles(page)
    await setupWsMock(page, stations, stats, {
      packets,
      stationHistory: { 'M0LHA-9': mobileHistory },
    })
    await page.goto('/')
    await page.waitForSelector('.station-marker', { timeout: 10000 })
    // Let markers and clusters settle
    await page.waitForTimeout(500)
  })

  test('map overview', async ({ page }) => {
    await saveScreenshot(page, 'map-overview.png')
    // Also verify markers rendered
    const markerCount = await page.locator('.station-marker').count()
    expect(markerCount).toBeGreaterThanOrEqual(5)
  })

  test('station popup', async ({ page }) => {
    // Click the mobile station marker to show a detailed popup
    const markers = page.locator('.station-marker')
    const count = await markers.count()
    for (let i = 0; i < count; i++) {
      // Close any existing popup first
      const existingPopup = page.locator('.leaflet-popup-close-button')
      if (await existingPopup.isVisible().catch(() => false)) {
        await existingPopup.click()
        await page
          .locator('.leaflet-popup')
          .waitFor({ state: 'hidden', timeout: 1000 })
          .catch(() => {})
      }
      await markers.nth(i).click({ force: true })
      const popup = page.locator('.leaflet-popup')
      try {
        await popup.waitFor({ state: 'visible', timeout: 1000 })
        if ((await popup.textContent())?.includes('M0LHA-9')) break
      } catch {
        // try next marker
      }
    }
    await page.waitForTimeout(300)
    await saveScreenshot(page, 'station-popup.png')
  })

  test('diagnostics panel', async ({ page }) => {
    await openDiagnosticsPanel(page)
    await page.waitForTimeout(300)
    await saveScreenshot(page, 'diagnostics-panel.png')
  })
})
