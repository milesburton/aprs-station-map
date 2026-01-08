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
): { callsign: string; ssid: number; isLast: boolean } => {
  let callsign = ''
  for (let i = 0; i < 6; i++) {
    const byte = bytes[offset + i]
    if (byte === undefined) continue
    const char = byte >> 1
    if (char !== 0x20) {
      // Not space
      callsign += String.fromCharCode(char)
    }
  }

  const ssidByte = bytes[offset + 6] ?? 0
  const ssid = (ssidByte >> 1) & 0x0f
  const isLast = (ssidByte & 0x01) === 1

  return {
    callsign: ssid > 0 ? `${callsign.trim()}-${ssid}` : callsign.trim(),
    ssid,
    isLast,
  }
}

const parseAx25Header = (
  packet: Uint8Array
): { source: string; destination: string; path: string[]; infoStart: number } | null => {
  if (packet.length < 16) return null // Minimum: dest(7) + src(7) + control(1) + pid(1)

  const destination = decodeCallsign(packet, 0)
  const source = decodeCallsign(packet, AX25_ADDR_LEN)

  const path: string[] = []
  let offset = AX25_ADDR_LEN * 2
  let lastAddress = source.isLast

  // Parse digipeater path
  while (!lastAddress && offset + AX25_ADDR_LEN <= packet.length) {
    const digi = decodeCallsign(packet, offset)
    path.push(digi.callsign)
    lastAddress = digi.isLast
    offset += AX25_ADDR_LEN
  }

  // Check for UI frame
  if (offset >= packet.length) return null
  const control = packet[offset]
  if (control !== AX25_UI_FRAME) return null
  offset++

  // Check PID
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

// Parse uncompressed position: !DDMM.hhN/DDDMM.hhW
const parseUncompressedPosition = (info: string): AprsPosition | null => {
  // Match patterns like: !5144.50N/00009.00E or /5144.50N/00009.00E
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

  return { latitude, longitude }
}

// Parse compressed position (base91 encoding)
const parseCompressedPosition = (info: string): AprsPosition | null => {
  // Compressed format: /YYYYXXXX$cs (symbol table, 4 lat chars, 4 lon chars, symbol, course/speed)
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

  return { latitude, longitude }
}

// Parse Mic-E encoded position (in destination field)
const parseMicEPosition = (destination: string, info: string): AprsPosition | null => {
  if (destination.length < 6 || info.length < 9) return null

  // Mic-E encodes latitude in destination callsign
  const latDigits: number[] = []
  const latNS: number[] = []
  const lonEW: number[] = []

  for (let i = 0; i < 6; i++) {
    const c = destination.charCodeAt(i)
    if (c >= 0x30 && c <= 0x39) {
      // 0-9
      latDigits.push(c - 0x30)
      latNS.push(0) // South
      lonEW.push(0)
    } else if (c >= 0x41 && c <= 0x4a) {
      // A-J (0-9, South)
      latDigits.push(c - 0x41)
      latNS.push(0)
      lonEW.push(1)
    } else if (c >= 0x4b && c <= 0x4b) {
      // K (space)
      latDigits.push(0)
      latNS.push(0)
      lonEW.push(1)
    } else if (c >= 0x4c && c <= 0x4c) {
      // L (space)
      latDigits.push(0)
      latNS.push(0)
      lonEW.push(0)
    } else if (c >= 0x50 && c <= 0x59) {
      // P-Y (0-9, North)
      latDigits.push(c - 0x50)
      latNS.push(1)
      lonEW.push(1)
    } else if (c >= 0x5a && c <= 0x5a) {
      // Z (space)
      latDigits.push(0)
      latNS.push(1)
      lonEW.push(1)
    } else {
      return null
    }
  }

  const latDeg = (latDigits[0] ?? 0) * 10 + (latDigits[1] ?? 0)
  const latMin =
    (latDigits[2] ?? 0) * 10 +
    (latDigits[3] ?? 0) +
    ((latDigits[4] ?? 0) * 10 + (latDigits[5] ?? 0)) / 100
  let latitude = latDeg + latMin / 60

  // Determine N/S from bit 3 (index 3)
  if (latNS[3] === 0) latitude = -latitude

  // Longitude is encoded in info field bytes 1-3 (after data type indicator)
  const d = info.charCodeAt(1) - 28
  const m = info.charCodeAt(2) - 28
  const h = info.charCodeAt(3) - 28

  let lonDeg = d
  if ((lonEW[4] ?? 0) === 1) lonDeg += 100
  if (lonDeg >= 180 && lonDeg <= 189) lonDeg -= 80
  if (lonDeg >= 190 && lonDeg <= 199) lonDeg -= 190

  let lonMin = m
  if (lonMin >= 60) lonMin -= 60

  let longitude = lonDeg + (lonMin + h / 100) / 60

  // Determine E/W from bit 5 (index 5)
  if ((lonEW[5] ?? 0) === 0) longitude = -longitude

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
      return 'position' // Mic-E
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

export const parseAprsPacket = (ax25Packet: Uint8Array): AprsPacket | null => {
  const header = parseAx25Header(ax25Packet)
  if (!header) return null

  const infoBytes = ax25Packet.slice(header.infoStart)
  const info = new TextDecoder().decode(infoBytes)

  if (info.length === 0) return null

  const dataType = getDataType(info[0])
  let position: AprsPosition | undefined
  let symbol = '-'
  let symbolTable = '/'
  let comment = ''

  if (dataType === 'position') {
    const firstChar = info[0]

    // Check for Mic-E
    if (firstChar === '`' || firstChar === "'") {
      position = parseMicEPosition(header.destination, info) ?? undefined
      if (info.length > 8) {
        symbol = info[7] ?? '-'
        symbolTable = info[8] ?? '/'
        comment = info.slice(9).trim()
      }
    } else {
      // Standard position
      position = parseUncompressedPosition(info) ?? parseCompressedPosition(info) ?? undefined

      // Extract symbol from position string
      const symbolMatch = info.match(/[/\\](.)/)
      if (symbolMatch) {
        symbolTable = info[info.indexOf(symbolMatch[0])] ?? '/'
        symbol = symbolMatch[1] ?? '-'
      }

      // Extract comment (everything after position)
      const commentMatch = info.match(/[NS][/\\][0-9]{3}[0-9]{2}\.[0-9]+[EW](.)(.*)/)
      if (commentMatch) {
        symbol = commentMatch[1] ?? '-'
        comment = (commentMatch[2] ?? '').trim()
      }
    }
  } else {
    comment = info.slice(1).trim()
  }

  return {
    source: header.source,
    destination: header.destination,
    path: header.path,
    type: dataType,
    position,
    symbol,
    symbolTable,
    comment,
    raw: info,
    timestamp: new Date(),
  }
}

// Convert raw bytes to hex string for debugging
export const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')
}
