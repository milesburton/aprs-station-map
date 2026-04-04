export interface AprsPosition {
  latitude: number
  longitude: number
  altitude?: number
  course?: number
  speed?: number
}

export interface AprsPacket {
  source: string
  destination: string
  path: string[]
  type: 'position' | 'status' | 'message' | 'telemetry' | 'weather' | 'unknown'
  position?: AprsPosition
  symbol: string
  symbolTable: string
  comment: string
  raw: string
  timestamp?: Date
}

// AX.25 address field is 7 bytes: 6 for callsign (shifted left 1 bit) + 1 for SSID
const AX25_ADDR_LEN = 7
const AX25_UI_FRAME = 0x03 // Unnumbered Information
const AX25_PID_NO_LAYER3 = 0xf0 // No layer 3 protocol

const decodeCallsign = (
  bytes: Uint8Array,
  offset: number
): { callsign: string; ssid: number; isLast: boolean; hasBeenRepeated: boolean } => {
  let callsign = ''
  for (let i = 0; i < 6; i++) {
    const byte = bytes[offset + i]
    if (byte === undefined) continue
    const char = byte >> 1
    if (char !== 0x20) {
      callsign += String.fromCharCode(char)
    }
  }

  const ssidByte = bytes[offset + 6] ?? 0
  const ssid = (ssidByte >> 1) & 0x0f
  const isLast = (ssidByte & 0x01) === 1
  const hasBeenRepeated = (ssidByte & 0x80) !== 0 // H-bit: set when digi has relayed the packet

  return {
    callsign: ssid > 0 ? `${callsign.trim()}-${ssid}` : callsign.trim(),
    ssid,
    isLast,
    hasBeenRepeated,
  }
}

const parseAx25Header = (
  packet: Uint8Array
): { source: string; destination: string; path: string[]; infoStart: number } | null => {
  if (packet.length < 16) return null

  const destination = decodeCallsign(packet, 0)
  const source = decodeCallsign(packet, AX25_ADDR_LEN)

  const path: string[] = []
  let offset = AX25_ADDR_LEN * 2
  let lastAddress = source.isLast

  // Append '*' to callsigns where the H-bit is set (has-been-repeated),
  // matching the conventional APRS text representation so RF/direct filters work.
  while (!lastAddress && offset + AX25_ADDR_LEN <= packet.length) {
    const digi = decodeCallsign(packet, offset)
    path.push(digi.hasBeenRepeated ? `${digi.callsign}*` : digi.callsign)
    lastAddress = digi.isLast
    offset += AX25_ADDR_LEN
  }

  if (offset >= packet.length) return null
  const control = packet[offset]
  if (control !== AX25_UI_FRAME) return null
  offset++

  if (offset >= packet.length) return null
  const pid = packet[offset]
  if (pid !== AX25_PID_NO_LAYER3) return null
  offset++

  return {
    source: source.callsign,
    destination: destination.callsign,
    path,
    infoStart: offset,
  }
}

const isValidPosition = (latitude: number, longitude: number): boolean => {
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return false
  // Reject null island (0,0) — stations with no GPS fix often report this
  if (latitude === 0 && longitude === 0) return false
  return true
}

const parseUncompressedPosition = (info: string): AprsPosition | null => {
  const match = info.match(
    /([0-9]{2})([0-9]{2}\.[0-9]+)([NS])[/\\]([0-9]{3})([0-9]{2}\.[0-9]+)([EW])/
  )
  if (!match) return null

  const latDeg = Number.parseInt(match[1] ?? '0', 10)
  const latMin = Number.parseFloat(match[2] ?? '0')
  const latHemi = match[3] ?? 'N'
  const lonDeg = Number.parseInt(match[4] ?? '0', 10)
  const lonMin = Number.parseFloat(match[5] ?? '0')
  const lonHemi = match[6] ?? 'E'

  let latitude = latDeg + latMin / 60
  let longitude = lonDeg + lonMin / 60

  if (latHemi === 'S') latitude = -latitude
  if (lonHemi === 'W') longitude = -longitude

  if (!isValidPosition(latitude, longitude)) return null
  return { latitude, longitude }
}

const parseCompressedPosition = (info: string): AprsPosition | null => {
  const match = info.match(/[/\\]([!-{]{4})([!-{]{4})(.)/)
  if (!match) return null

  const base91Decode = (chars: string): number => {
    let value = 0
    for (const char of chars) {
      value = value * 91 + (char.charCodeAt(0) - 33)
    }
    return value
  }

  const latVal = base91Decode(match[1] ?? '')
  const lonVal = base91Decode(match[2] ?? '')

  const latitude = 90 - latVal / 380926
  const longitude = -180 + lonVal / 190463

  if (!isValidPosition(latitude, longitude)) return null
  return { latitude, longitude }
}

function parseMicELatLon(destination: string, _info: string) {
  const latDigits: number[] = []
  const latNS: number[] = []
  const lonEW: number[] = []
  for (let i = 0; i < 6; i++) {
    const c = destination.charCodeAt(i)
    if (c >= 0x30 && c <= 0x39) {
      latDigits.push(c - 0x30)
      latNS.push(0)
      lonEW.push(0)
    } else if (c >= 0x41 && c <= 0x4a) {
      latDigits.push(c - 0x41)
      latNS.push(0)
      lonEW.push(1)
    } else if (c === 0x4b) {
      latDigits.push(0)
      latNS.push(0)
      lonEW.push(1)
    } else if (c === 0x4c) {
      latDigits.push(0)
      latNS.push(0)
      lonEW.push(0)
    } else if (c >= 0x50 && c <= 0x59) {
      latDigits.push(c - 0x50)
      latNS.push(1)
      lonEW.push(1)
    } else if (c === 0x5a) {
      latDigits.push(0)
      latNS.push(1)
      lonEW.push(1)
    } else {
      return null
    }
  }
  return { latDigits, latNS, lonEW }
}

const parseMicEPosition = (destination: string, info: string): AprsPosition | null => {
  if (destination.length < 6 || info.length < 9) return null
  const parsed = parseMicELatLon(destination, info)
  if (!parsed) return null
  const { latDigits, latNS, lonEW } = parsed
  const latDeg = (latDigits[0] ?? 0) * 10 + (latDigits[1] ?? 0)
  const latMin =
    (latDigits[2] ?? 0) * 10 +
    (latDigits[3] ?? 0) +
    ((latDigits[4] ?? 0) * 10 + (latDigits[5] ?? 0)) / 100
  let latitude = latDeg + latMin / 60
  if (latNS[3] === 0) latitude = -latitude
  const d = info.charCodeAt(1) - 28
  const m = info.charCodeAt(2) - 28
  const h = info.charCodeAt(3) - 28
  let lonDeg = d
  if ((lonEW[4] ?? 0) === 1) lonDeg += 100
  if (lonDeg >= 190 && lonDeg <= 199) lonDeg -= 190
  else if (lonDeg >= 180 && lonDeg <= 189) lonDeg -= 80
  let lonMin = m
  if (lonMin >= 60) lonMin -= 60
  let longitude = lonDeg + (lonMin + h / 100) / 60
  if ((lonEW[5] ?? 0) === 0) longitude = -longitude
  if (!isValidPosition(latitude, longitude)) return null
  return { latitude, longitude }
}

const getDataType = (char: string | undefined): AprsPacket['type'] => {
  switch (char) {
    case '!':
    case '=':
    case '/':
    case '@':
      return 'position'
    case '`':
    case "'":
      return 'position'
    case ';':
    case ')':
      return 'position'
    case '>':
      return 'status'
    case ':':
      return 'message'
    case 'T':
      return 'telemetry'
    case '_':
      return 'weather'
    default:
      return 'unknown'
  }
}

function extractSymbolAndComment(info: string): {
  symbol: string
  symbolTable: string
  comment: string
} {
  let symbol = '-'
  let symbolTable = '/'
  let comment = ''
  const symbolMatch = info.match(/[/\\](.)/)
  if (symbolMatch) {
    symbolTable = info[info.indexOf(symbolMatch[0])] ?? '/'
    symbol = symbolMatch[1] ?? '-'
  }
  const commentMatch = info.match(/[NS][/\\][0-9]{3}[0-9]{2}\.[0-9]+[EW](.)(.*)/)
  if (commentMatch) {
    symbol = commentMatch[1] ?? '-'
    comment = (commentMatch[2] ?? '').trim()
  }
  return { symbol, symbolTable, comment }
}

export const parseAprsInfo = (
  info: string,
  destination: string
): Omit<AprsPacket, 'source' | 'destination' | 'path' | 'raw'> => {
  const dataType = getDataType(info[0])
  let position: AprsPosition | undefined
  let symbol = '-'
  let symbolTable = '/'
  let comment = ''

  if (dataType === 'position') {
    const firstChar = info[0]
    if (firstChar === '`' || firstChar === "'") {
      position = parseMicEPosition(destination, info) ?? undefined
      if (info.length > 8) {
        symbol = info[7] ?? '-'
        symbolTable = info[8] ?? '/'
        comment = info.slice(9).trim()
      }
    } else {
      position = parseUncompressedPosition(info) ?? parseCompressedPosition(info) ?? undefined
      const extracted = extractSymbolAndComment(info)
      symbol = extracted.symbol
      symbolTable = extracted.symbolTable
      comment = extracted.comment
    }
  } else {
    comment = info.slice(1).trim()
  }

  return { type: dataType, position, symbol, symbolTable, comment, timestamp: new Date() }
}

export const parseAprsPacket = (ax25Packet: Uint8Array): AprsPacket | null => {
  const header = parseAx25Header(ax25Packet)
  if (!header) return null
  const infoBytes = ax25Packet.slice(header.infoStart)
  const info = new TextDecoder().decode(infoBytes)
  if (info.length === 0) return null
  const parsed = parseAprsInfo(info, header.destination)
  return {
    source: header.source,
    destination: header.destination,
    path: header.path,
    raw: info,
    ...parsed,
  }
}

export const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')
}
