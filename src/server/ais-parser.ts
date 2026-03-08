export interface ParsedAisMessage {
  mmsi: string
  callsign?: string
  shipName?: string
  latitude: number
  longitude: number
  course?: number
  speed?: number
  heading?: number
  shipType?: number
  status?: number
  timestamp: string
}

const AIS_DECODE_TABLE = '@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_ !"#$%&\'()*+,-./0123456789:;<=>?'

const decodePayload = (payload: string): number[] => {
  const bits: number[] = []
  for (const char of payload) {
    const code = char.charCodeAt(0)
    let sixBits = code - 48
    if (sixBits > 40) {
      sixBits -= 8
    }
    if (sixBits < 0 || sixBits > 63) continue

    for (let i = 5; i >= 0; i--) {
      bits.push((sixBits >> i) & 1)
    }
  }
  return bits
}

const extractBits = (bits: number[], start: number, length: number): number => {
  let value = 0
  for (let i = 0; i < length; i++) {
    const bit = bits[start + i]
    if (bit === undefined) {
      return 0
    }
    value = (value << 1) | bit
  }

  return value
}

const extractSignedBits = (bits: number[], start: number, length: number): number => {
  const unsignedValue = extractBits(bits, start, length)
  const signBit = 1 << (length - 1)
  if ((unsignedValue & signBit) === 0) {
    return unsignedValue
  }
  return unsignedValue - (1 << length)
}

const extractString = (bits: number[], start: number, length: number): string => {
  let result = ''
  for (let i = 0; i < length; i += 6) {
    const charCode = extractBits(bits, start + i, 6)
    const char = AIS_DECODE_TABLE[charCode]
    if (char) {
      result += char
    }
  }
  return result.trim()
}

export const parseNmeaSentence = (sentence: string): ParsedAisMessage | null => {
  const parts = sentence.split('*')
  const cleanSentence = parts[0]
  if (!cleanSentence) {
    return null
  }

  if (!cleanSentence.startsWith('!AIVD') && !cleanSentence.startsWith('$AIVD')) {
    return null
  }

  const fields = cleanSentence.substring(1).split(',')
  if (fields.length < 5) {
    return null
  }

  const payload = fields[5] || ''
  if (!payload) {
    return null
  }

  return parseAisPayload(payload)
}

export const parseAisPayload = (payload: string): ParsedAisMessage | null => {
  const bits = decodePayload(payload)

  if (bits.length < 38) {
    return null
  }

  const messageType = extractBits(bits, 0, 6)

  if (messageType !== 1 && messageType !== 2 && messageType !== 3 && messageType !== 5) {
    return null
  }

  const mmsi = extractBits(bits, 8, 30).toString().padStart(9, '0')

  if (messageType === 5) {
    if (bits.length < 168) return null

    const callsign = extractString(bits, 70, 42)
    const shipName = extractString(bits, 112, 120)

    return {
      mmsi,
      callsign: callsign || undefined,
      shipName: shipName || undefined,
      latitude: 0,
      longitude: 0,
      timestamp: new Date().toISOString(),
    }
  }

  if (bits.length < 168) return null

  const longitude = extractSignedBits(bits, 61, 28) / 600000
  const latitude = extractSignedBits(bits, 89, 27) / 600000

  const sog = extractBits(bits, 50, 10)
  const cog = extractBits(bits, 116, 12)
  const trueHeading = extractBits(bits, 128, 9)

  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return null
  }

  return {
    mmsi,
    latitude,
    longitude,
    speed: sog === 1023 ? undefined : sog * 0.1,
    course: cog === 3600 ? undefined : cog / 10,
    heading: trueHeading === 511 ? undefined : trueHeading,
    timestamp: new Date().toISOString(),
  }
}

export const parseAisLine = (line: string): ParsedAisMessage | null => {
  const trimmed = line.trim()
  if (!trimmed) {
    return null
  }

  return parseNmeaSentence(trimmed)
}
