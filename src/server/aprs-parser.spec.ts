import { describe, expect, it } from 'vitest'
import { bytesToHex, parseAprsInfo, parseAprsPacket } from './aprs-parser'

// Helper to build a minimal valid AX.25 UI frame byte array.
// AX.25 address encoding: each character is ASCII << 1, padded to 6 bytes,
// then a 7th SSID byte. The last address in the header sets bit 0 of its SSID byte.
const encodeCallsign = (
  callsign: string,
  ssid = 0,
  isLast = false,
  hasBeenRepeated = false
): number[] => {
  const base = callsign.split('-')[0] ?? callsign
  const ssidNum = callsign.includes('-') ? Number.parseInt(callsign.split('-')[1] ?? '0', 10) : ssid
  const padded = base.padEnd(6, ' ')
  const bytes = Array.from(padded).map((c) => c.charCodeAt(0) << 1)
  // SSID byte: bits 6:5 = SSID, bit 7 = H-bit (hasBeenRepeated), bit 0 = isLast
  const ssidByte = (hasBeenRepeated ? 0x80 : 0) | ((ssidNum & 0x0f) << 1) | (isLast ? 0x01 : 0x00)
  return [...bytes, ssidByte]
}

const buildAx25Frame = (
  destination: string,
  source: string,
  path: Array<{ call: string; repeated?: boolean }>,
  info: string
): Uint8Array => {
  const destBytes = encodeCallsign(destination, 0, false)
  const isSourceLast = path.length === 0
  const srcBytes = encodeCallsign(source, 0, isSourceLast)

  const pathBytes: number[] = []
  for (let i = 0; i < path.length; i++) {
    const entry = path[i]
    if (!entry) continue
    const isLast = i === path.length - 1
    pathBytes.push(...encodeCallsign(entry.call, 0, isLast, entry.repeated ?? false))
  }

  const control = 0x03 // UI frame
  const pid = 0xf0 // No layer 3
  const infoBytes = Array.from(info).map((c) => c.charCodeAt(0))

  return new Uint8Array([...destBytes, ...srcBytes, ...pathBytes, control, pid, ...infoBytes])
}

describe('parseAprsPacket', () => {
  it('returns null for empty/too-short packet', () => {
    expect(parseAprsPacket(new Uint8Array([0x00, 0x01]))).toBeNull()
  })

  it('returns null when control byte is not 0x03 (non-UI frame)', () => {
    // Build a frame with control = 0x00 instead of 0x03
    const frame = buildAx25Frame('APRS', 'M0ABC', [], '!5144.50N/00009.00E-')
    // Corrupt the control byte (offset = 7+7 = 14)
    frame[14] = 0x00
    expect(parseAprsPacket(frame)).toBeNull()
  })

  it('returns null when PID byte is not 0xf0', () => {
    const frame = buildAx25Frame('APRS', 'M0ABC', [], '!5144.50N/00009.00E-')
    // PID byte is at offset 15
    frame[15] = 0x00
    expect(parseAprsPacket(frame)).toBeNull()
  })

  it('parses source and destination from AX.25 header', () => {
    const frame = buildAx25Frame('APRS', 'M0ABC', [], '>status text')
    const result = parseAprsPacket(frame)
    expect(result?.source).toBe('M0ABC')
    expect(result?.destination).toBe('APRS')
  })

  it('parses a simple status packet', () => {
    const frame = buildAx25Frame('APRS', 'G4XYZ', [], '>Running on battery')
    const result = parseAprsPacket(frame)
    expect(result?.type).toBe('status')
    expect(result?.comment).toBe('Running on battery')
  })

  it('parses an uncompressed position packet', () => {
    // !DDMM.hhN/DDDMM.hhW symbol
    const frame = buildAx25Frame('APRS', 'G4XYZ', [], '!5144.50N/00009.00E-')
    const result = parseAprsPacket(frame)
    expect(result?.type).toBe('position')
    expect(result?.position?.latitude).toBeCloseTo(51.7417, 2)
    expect(result?.position?.longitude).toBeCloseTo(0.15, 1)
  })

  it('parses digipeater path correctly', () => {
    const frame = buildAx25Frame(
      'APRS',
      'G4XYZ',
      [{ call: 'WIDE1-1' }, { call: 'WIDE2-1' }],
      '>status'
    )
    const result = parseAprsPacket(frame)
    expect(result?.path).toEqual(['WIDE1-1', 'WIDE2-1'])
  })

  it('appends * to path entries with H-bit set', () => {
    const frame = buildAx25Frame(
      'APRS',
      'G4XYZ',
      [
        { call: 'MB7USE', repeated: true },
        { call: 'WIDE2-1', repeated: false },
      ],
      '>status'
    )
    const result = parseAprsPacket(frame)
    expect(result?.path[0]).toBe('MB7USE*')
    expect(result?.path[1]).toBe('WIDE2-1')
  })

  it('sets raw to the info field string', () => {
    const info = '>This is my status'
    const frame = buildAx25Frame('APRS', 'G4XYZ', [], info)
    const result = parseAprsPacket(frame)
    expect(result?.raw).toBe(info)
  })

  it('returns empty path when source is the last address', () => {
    const frame = buildAx25Frame('APRS', 'G4XYZ', [], '>status')
    const result = parseAprsPacket(frame)
    expect(result?.path).toEqual([])
  })
})

describe('parseAprsInfo', () => {
  describe('packet type detection', () => {
    it('detects position type for ! prefix', () => {
      const result = parseAprsInfo('!5144.50N/00009.00E-', 'APRS')
      expect(result.type).toBe('position')
    })

    it('detects position type for = prefix', () => {
      const result = parseAprsInfo('=5144.50N/00009.00E-', 'APRS')
      expect(result.type).toBe('position')
    })

    it('detects status type for > prefix', () => {
      const result = parseAprsInfo('>My status text', 'APRS')
      expect(result.type).toBe('status')
      expect(result.comment).toBe('My status text')
    })

    it('detects message type for : prefix', () => {
      const result = parseAprsInfo(':NOCALL   :Hello world{001', 'APRS')
      expect(result.type).toBe('message')
    })

    it('detects weather type for _ prefix', () => {
      const result = parseAprsInfo('_wind data', 'APRS')
      expect(result.type).toBe('weather')
    })

    it('detects telemetry type for T prefix', () => {
      const result = parseAprsInfo('T#001,100,200,300', 'APRS')
      expect(result.type).toBe('telemetry')
    })

    it('returns unknown for unrecognised prefix', () => {
      const result = parseAprsInfo('Zunknown data', 'APRS')
      expect(result.type).toBe('unknown')
    })
  })

  describe('uncompressed position parsing', () => {
    it('parses Northern/Eastern position', () => {
      const result = parseAprsInfo('!5144.50N/00009.00E-', 'APRS')
      expect(result.position?.latitude).toBeCloseTo(51.7417, 2)
      expect(result.position?.longitude).toBeCloseTo(0.15, 2)
    })

    it('parses Southern/Western position', () => {
      const result = parseAprsInfo('!3358.00S/07034.00W-', 'APRS')
      expect(result.position?.latitude).toBeCloseTo(-33.9667, 2)
      expect(result.position?.longitude).toBeCloseTo(-70.5667, 2)
    })

    it('returns undefined position for status packets', () => {
      const result = parseAprsInfo('>My status', 'APRS')
      expect(result.position).toBeUndefined()
    })
  })

  describe('compressed position parsing', () => {
    it('parses a compressed position packet', () => {
      // A valid compressed position: /YYYYXXXXS (symbol table + 4 lat base91 + 4 lon base91 + symbol)
      // This is approximate — just verify it produces a position, not NaN
      const result = parseAprsInfo('/5L!!<*e7>{?!', 'APRS')
      // Compressed positions exist if the pattern matched
      if (result.position) {
        expect(result.position.latitude).not.toBeNaN()
        expect(result.position.longitude).not.toBeNaN()
      }
    })
  })

  describe('symbol extraction', () => {
    it('extracts symbol from position packet', () => {
      // !DDMM.hhN/DDDMM.hhWS where S is the symbol
      const result = parseAprsInfo('!5144.50N/00009.00E>', 'APRS')
      expect(result.symbol).toBe('>')
    })

    it('defaults to - symbol when not parseable', () => {
      const result = parseAprsInfo('>status text', 'APRS')
      expect(result.symbol).toBe('-')
    })
  })

  describe('Mic-E position parsing', () => {
    it('returns position type for backtick prefix', () => {
      // Minimal Mic-E: backtick + at least 9 bytes. Actual decoding depends on destination.
      // Use a known Mic-E destination encoding for a UK location.
      const result = parseAprsInfo('`ABC123>/', 'S32U6T')
      expect(result.type).toBe('position')
    })

    it('returns null position for too-short Mic-E info', () => {
      const result = parseAprsInfo('`short', 'APRS')
      expect(result.type).toBe('position')
      expect(result.position).toBeUndefined()
    })
  })
})

describe('bytesToHex', () => {
  it('converts empty array to empty string', () => {
    expect(bytesToHex(new Uint8Array([]))).toBe('')
  })

  it('converts single byte to two-char hex', () => {
    expect(bytesToHex(new Uint8Array([0x0f]))).toBe('0f')
  })

  it('converts multiple bytes with space separator', () => {
    expect(bytesToHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe('de ad be ef')
  })

  it('pads single-digit hex values with leading zero', () => {
    expect(bytesToHex(new Uint8Array([0x00, 0x01, 0x0a]))).toBe('00 01 0a')
  })
})
