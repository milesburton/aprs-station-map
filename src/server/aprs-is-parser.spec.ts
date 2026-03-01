import { describe, expect, it } from 'vitest'
import { parseAprsIsPacket } from './aprs-is-parser'

describe('parseAprsIsPacket', () => {
  it('returns null for lines with no colon separator', () => {
    expect(parseAprsIsPacket('NOCALLSIGN')).toBeNull()
  })

  it('returns null for lines with no > in the header', () => {
    expect(parseAprsIsPacket('NOCALLSIGN:payload')).toBeNull()
  })

  it('returns null for lines with empty payload', () => {
    expect(parseAprsIsPacket('M0ABC>APDR16:')).toBeNull()
  })

  it('parses source and destination correctly', () => {
    const result = parseAprsIsPacket('M0ABC-9>APDR16,TCPIP*,qAC:=5126.50N/00009.10W$/A=000075')
    expect(result).not.toBeNull()
    expect(result?.source).toBe('M0ABC-9')
    expect(result?.destination).toBe('APDR16')
  })

  it('parses digipeater path correctly', () => {
    const result = parseAprsIsPacket('G1XYZ>APRS,WIDE1-1,WIDE2-1:!5144.50N/00009.00E-')
    expect(result?.path).toEqual(['WIDE1-1', 'WIDE2-1'])
  })

  it('parses an uncompressed position packet', () => {
    const result = parseAprsIsPacket('M0ABC>APRS,TCPIP*:=5126.50N/00009.10W-')
    expect(result).not.toBeNull()
    expect(result?.type).toBe('position')
    expect(result?.position?.latitude).toBeCloseTo(51.4417, 2)
    expect(result?.position?.longitude).toBeCloseTo(-0.1517, 2)
  })

  it('sets raw to the payload after the colon', () => {
    const payload = '=5126.50N/00009.10W-test comment'
    const result = parseAprsIsPacket(`M0ABC>APRS:${payload}`)
    expect(result?.raw).toBe(payload)
  })

  it('handles path with a single digipeater', () => {
    const result = parseAprsIsPacket('M0ABC-1>APRS,RELAY*:>status text')
    expect(result?.path).toEqual(['RELAY*'])
  })

  it('handles a path-less packet (source>dest only)', () => {
    const result = parseAprsIsPacket('M0ABC>APRS:>status text')
    expect(result?.path).toEqual([])
    expect(result?.type).toBe('status')
  })

  it('uppercases source and destination', () => {
    const result = parseAprsIsPacket('m0abc>aprs:>status')
    expect(result?.source).toBe('M0ABC')
    expect(result?.destination).toBe('APRS')
  })

  it('identifies a status packet type', () => {
    const result = parseAprsIsPacket('M0ABC>APRS:>My status')
    expect(result?.type).toBe('status')
  })

  it('identifies a weather packet type', () => {
    const result = parseAprsIsPacket('M0WX>APRS:_wind data here')
    expect(result?.type).toBe('weather')
  })

  it('handles APRS-IS server comment lines gracefully when passed in', () => {
    // Comment lines should be filtered before calling the parser,
    // but if one slips through it should return null (no '>' in header)
    expect(parseAprsIsPacket('# aprsc 2.1.14 server comment')).toBeNull()
  })
})
