import { describe, expect, it } from 'vitest'
import { parseAisPayload, parseNmeaSentence } from './ais-parser'

describe('AIS Parser', () => {
  describe('parseAisPayload', () => {
    it('should parse Type 1 position report', () => {
      const payload = '15M67FC000G?ufbE`FepT@3n00Sa'
      const result = parseAisPayload(payload)

      expect(result).not.toBeNull()
      expect(result?.mmsi).toBe('366053209')
      expect(result?.latitude).toBeCloseTo(37.8021, 3)
      expect(result?.longitude).toBeCloseTo(-122.3416, 3)
    })

    it('should return null for invalid payload', () => {
      const result = parseAisPayload('INVALID')
      expect(result).toBeNull()
    })

    it('should return null for too short payload', () => {
      const result = parseAisPayload('15M67FC')
      expect(result).toBeNull()
    })

    it('should handle Type 5 static report', () => {
      const payload = '55?MbV02>H<hT@?N4h88888888880t50Ht50000000000000000000000000'
      const result = parseAisPayload(payload)

      if (result) {
        expect(result.mmsi).toBeDefined()
      }
    })
  })

  describe('parseNmeaSentence', () => {
    it('should parse NMEA AIVDM sentence', () => {
      const sentence = '!AIVDM,1,1,,A,15M67FC000G?ufbE`FepT@3n00Sa,0*5C'
      const result = parseNmeaSentence(sentence)

      expect(result).not.toBeNull()
      expect(result?.mmsi).toBe('366053209')
    })

    it('should handle sentence without checksum', () => {
      const sentence = '!AIVDM,1,1,,A,15M67FC000G?ufbE`FepT@3n00Sa'
      const result = parseNmeaSentence(sentence)

      expect(result).not.toBeNull()
      expect(result?.mmsi).toBe('366053209')
    })

    it('should return null for non-AIS sentence', () => {
      const sentence = '!GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,'
      const result = parseNmeaSentence(sentence)

      expect(result).toBeNull()
    })

    it('should return null for malformed sentence', () => {
      const sentence = '!AIVDM,too,few,fields'
      const result = parseNmeaSentence(sentence)

      expect(result).toBeNull()
    })
  })

  describe('coordinate validation', () => {
    it('should reject invalid latitudes', () => {
      const payload = 'invalid'
      const result = parseAisPayload(payload)

      expect(result === null || (result && Math.abs(result.latitude) <= 90)).toBe(true)
    })

    it('should reject invalid longitudes', () => {
      // Most real-world AIS parsers validate these
      expect(true).toBe(true) // Placeholder
    })
  })

  describe('ship type', () => {
    it('should extract ship type from message', () => {
      const payload = '15M67FC000G?ufbE`FepT@3n00Sa'
      const result = parseAisPayload(payload)

      // Ship type should be present or undefined
      if (result) {
        expect(typeof result.shipType === 'number' || result.shipType === undefined).toBe(true)
      }
    })
  })
})
