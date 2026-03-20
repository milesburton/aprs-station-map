import type { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AisClient, closeAisClient, getAisClient } from './ais-client'

const makeClient = (source: 'kiss' | 'http' | 'none' = 'kiss') =>
  new AisClient({ source, kissHost: 'localhost', kissPort: 8002, kissReconnectIntervalMs: 60000 })

const getSocket = (client: AisClient) => (client as unknown as { socket: EventEmitter }).socket

describe('AisClient — source: none', () => {
  it('does not emit connected', () => {
    const client = makeClient('none')
    const spy = vi.fn()
    client.on('connected', spy)
    client.connect()
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('AisClient — source: http', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('emits connected immediately', () => {
    const client = makeClient('http')
    const spy = vi.fn()
    client.on('connected', spy)
    client.connect()
    expect(spy).toHaveBeenCalledTimes(1)
    client.disconnect()
  })

  it('getConnected returns true after connect', () => {
    const client = makeClient('http')
    client.connect()
    expect(client.getConnected()).toBe(true)
    client.disconnect()
  })
})

describe('AisClient — source: kiss', () => {
  let client: AisClient
  let socket: EventEmitter

  beforeEach(() => {
    vi.useFakeTimers()
    client = makeClient('kiss')
    client.connect()
    socket = getSocket(client)
    socket.emit('connect')
  })

  afterEach(() => {
    client.disconnect()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('emits connected when socket connects', () => {
    const spy = vi.fn()
    // Already connected in beforeEach — create fresh client to observe
    const c = makeClient('kiss')
    c.on('connected', spy)
    c.connect()
    getSocket(c).emit('connect')
    expect(spy).toHaveBeenCalledTimes(1)
    c.disconnect()
  })

  it('emits vessel when valid AIS NMEA line received', () => {
    const spy = vi.fn()
    client.on('vessel', spy)
    socket.emit('data', Buffer.from('!AIVDM,1,1,,A,15M67N0000G?Uf6E>FepT@3n0<0t,0*73\n'))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('ignores invalid/non-NMEA data', () => {
    const spy = vi.fn()
    client.on('vessel', spy)
    socket.emit('data', Buffer.from('garbage data here\n'))
    expect(spy).not.toHaveBeenCalled()
  })

  it('emits disconnected when socket closes', () => {
    const spy = vi.fn()
    client.on('disconnected', spy)
    socket.emit('close')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('emits error on socket error', () => {
    const spy = vi.fn()
    client.on('error', spy)
    socket.emit('error', new Error('connection refused'))
    expect(spy).toHaveBeenCalledWith(expect.any(Error))
  })

  it('getConnected is true while connected', () => {
    expect(client.getConnected()).toBe(true)
  })

  it('getConnected returns false after disconnect', () => {
    client.disconnect()
    expect(client.getConnected()).toBe(false)
  })
})

describe('AisClient — getConnected before connect', () => {
  it('returns false', () => {
    expect(makeClient('kiss').getConnected()).toBe(false)
  })
})

describe('AisClient — getVessels / getVessel', () => {
  it('getVessels returns empty array initially', () => {
    expect(makeClient('none').getVessels()).toEqual([])
  })

  it('getVessel returns undefined for unknown mmsi', () => {
    expect(makeClient('none').getVessel('123456789')).toBeUndefined()
  })
})

describe('AisClient — singleton', () => {
  afterEach(() => closeAisClient())

  it('getAisClient returns the same instance on repeated calls', () => {
    const a = getAisClient({ source: 'none' })
    const b = getAisClient({ source: 'none' })
    expect(a).toBe(b)
  })

  it('closeAisClient resets singleton', () => {
    const a = getAisClient({ source: 'none' })
    closeAisClient()
    const b = getAisClient({ source: 'none' })
    expect(a).not.toBe(b)
  })
})
