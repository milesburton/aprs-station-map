import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AprsIsClient } from './aprs-is-client'

// Build a mock socket we can emit events on and inspect writes
const makeMockSocket = () => {
  const socket = new EventEmitter() as EventEmitter & {
    write: ReturnType<typeof vi.fn>
    end: ReturnType<typeof vi.fn>
    connect: ReturnType<typeof vi.fn>
    destroyed: boolean
  }
  socket.write = vi.fn()
  socket.end = vi.fn()
  socket.connect = vi.fn((_port, _host) => socket.emit('connect'))
  socket.destroyed = false
  return socket
}

describe('AprsIsClient', () => {
  let client: AprsIsClient
  let socket: ReturnType<typeof makeMockSocket>

  beforeEach(() => {
    socket = makeMockSocket()
    // Inject mock socket factory so no real TCP connections are made
    client = new AprsIsClient({
      host: 'rotate.aprs2.net',
      port: 14580,
      callsign: 'TEST-1',
      passcode: '12345',
      filter: 'r/51.5/-0.1/200',
      appVersion: 'test',
      reconnectIntervalMs: 60000,
      socketFactory: () => socket as unknown as import('node:net').Socket,
    })
  })

  afterEach(() => {
    client.disconnect()
    vi.clearAllMocks()
  })

  it('sends login line after socket connects', () => {
    client.connect()
    expect(socket.write).toHaveBeenCalledWith(
      expect.stringContaining('USER TEST-1 pass 12345 vers test filter r/51.5/-0.1/200')
    )
  })

  it('emits connected event after receiving logresp verified line', () => {
    const connectedSpy = vi.fn()
    client.on('connected', connectedSpy)
    client.connect()
    socket.emit('data', Buffer.from('# logresp TEST-1 verified, server T2TEST\r\n'))
    expect(connectedSpy).toHaveBeenCalledTimes(1)
  })

  it('emits packet event for non-comment lines', () => {
    const packetSpy = vi.fn()
    client.on('packet', packetSpy)
    client.connect()
    const line = 'M0ABC>APRS,TCPIP*:=5126.50N/00009.10W-'
    socket.emit('data', Buffer.from(`${line}\r\n`))
    expect(packetSpy).toHaveBeenCalledWith(line)
  })

  it('does not emit packet for server comment lines', () => {
    const packetSpy = vi.fn()
    client.on('packet', packetSpy)
    client.connect()
    socket.emit('data', Buffer.from('# aprsc 2.1.14 some comment\r\n'))
    expect(packetSpy).not.toHaveBeenCalled()
  })

  it('handles data split across multiple chunks', () => {
    const packetSpy = vi.fn()
    client.on('packet', packetSpy)
    client.connect()
    socket.emit('data', Buffer.from('M0ABC>APRS:>sta'))
    expect(packetSpy).not.toHaveBeenCalled()
    socket.emit('data', Buffer.from('tus\r\n'))
    expect(packetSpy).toHaveBeenCalledWith('M0ABC>APRS:>status')
  })

  it('emits disconnected when socket closes', () => {
    const disconnectedSpy = vi.fn()
    client.on('disconnected', disconnectedSpy)
    client.connect()
    socket.emit('close')
    expect(disconnectedSpy).toHaveBeenCalledTimes(1)
  })

  it('emits error on socket error', () => {
    const errorSpy = vi.fn()
    client.on('error', errorSpy)
    client.connect()
    socket.emit('error', new Error('connection refused'))
    expect(errorSpy).toHaveBeenCalledWith(expect.any(Error))
  })

  it('isConnected returns false after disconnect()', () => {
    client.connect()
    client.disconnect()
    socket.destroyed = true
    expect(client.isConnected).toBe(false)
  })
})
