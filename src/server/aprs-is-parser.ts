import { type AprsPacket, parseAprsInfo } from './aprs-parser'

// Parse an APRS-IS text line into an AprsPacket.
//
// APRS-IS packets have the format:
//   SOURCE>DESTINATION,PATH,PATH:payload
//
// Examples:
//   M0ABC-9>APDR16,TCPIP*,qAC,T2SERVER:=5126.50N/00009.10W$/A=000075 comment
//   G1XYZ>APRS,WIDE1-1,WIDE2-1:!5144.50N/00009.00E-PHG5360/comment
//
// Comment lines starting with '#' should be filtered before calling this function.
export const parseAprsIsPacket = (line: string): AprsPacket | null => {
  // Split header from payload at the first ':'
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) return null

  const header = line.slice(0, colonIdx)
  const payload = line.slice(colonIdx + 1)
  if (payload.length === 0) return null

  // Split header into source>dest,path fields
  const arrowIdx = header.indexOf('>')
  if (arrowIdx === -1) return null

  const source = header.slice(0, arrowIdx).trim().toUpperCase()
  if (source.length === 0) return null

  const destAndPath = header.slice(arrowIdx + 1).split(',')
  const destination = (destAndPath[0] ?? '').trim().toUpperCase()
  const path = destAndPath
    .slice(1)
    .map((s) => s.trim())
    .filter(Boolean)

  const parsed = parseAprsInfo(payload, destination)

  return {
    source,
    destination,
    path,
    raw: payload,
    ...parsed,
  }
}
