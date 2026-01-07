import { describe, expect, test } from 'bun:test'
import { parseKml } from '../../src/services/kml-loader'
import { BEXLEY_LOCATION } from '../../src/constants'

const sampleKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>M0LHA-1</name>
      <description>Test station&lt;br&gt;Symbol: -&lt;br&gt;Via: GB7DK,WIDE1-1</description>
      <Point>
        <coordinates>0.1234,51.5678,0</coordinates>
      </Point>
    </Placemark>
    <Placemark>
      <name>G4ABC</name>
      <description>Mobile&lt;br&gt;Symbol: &gt;</description>
      <Point>
        <coordinates>-0.5,51.3,0</coordinates>
      </Point>
    </Placemark>
    <Placemark>
      <name>INVALID</name>
      <description>Null island station</description>
      <Point>
        <coordinates>0,0,0</coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>`

describe('KML loader', () => {
  describe('parseKml', () => {
    test('parses valid stations from KML', () => {
      const stations = parseKml(sampleKml, BEXLEY_LOCATION)
      expect(stations).toHaveLength(2)
    })

    test('extracts callsign from name', () => {
      const stations = parseKml(sampleKml, BEXLEY_LOCATION)
      expect(stations[0]?.callsign).toBe('M0LHA-1')
      expect(stations[1]?.callsign).toBe('G4ABC')
    })

    test('extracts coordinates', () => {
      const stations = parseKml(sampleKml, BEXLEY_LOCATION)
      expect(stations[0]?.coordinates.longitude).toBeCloseTo(0.1234, 4)
      expect(stations[0]?.coordinates.latitude).toBeCloseTo(51.5678, 4)
    })

    test('parses symbol from description', () => {
      const stations = parseKml(sampleKml, BEXLEY_LOCATION)
      expect(stations[0]?.symbol).toBe('-')
      expect(stations[1]?.symbol).toBe('>')
    })

    test('parses via path from description', () => {
      const stations = parseKml(sampleKml, BEXLEY_LOCATION)
      expect(stations[0]?.via).toEqual(['GB7DK', 'WIDE1-1'])
    })

    test('calculates distance from reference', () => {
      const stations = parseKml(sampleKml, BEXLEY_LOCATION)
      expect(stations[0]?.distance).toBeGreaterThan(0)
      expect(stations[0]?.distance).toBeLessThan(50)
    })

    test('calculates bearing from reference', () => {
      const stations = parseKml(sampleKml, BEXLEY_LOCATION)
      expect(stations[0]?.bearing).toBeGreaterThanOrEqual(0)
      expect(stations[0]?.bearing).toBeLessThan(360)
    })

    test('filters out null island coordinates', () => {
      const stations = parseKml(sampleKml, BEXLEY_LOCATION)
      const invalidStation = stations.find((s) => s.callsign === 'INVALID')
      expect(invalidStation).toBeUndefined()
    })

    test('handles empty KML', () => {
      const emptyKml = `<?xml version="1.0"?><kml><Document></Document></kml>`
      const stations = parseKml(emptyKml, BEXLEY_LOCATION)
      expect(stations).toHaveLength(0)
    })
  })
})
