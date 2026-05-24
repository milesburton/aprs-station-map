import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStations } from './use-stations'

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen: ((e: Event) => void) | null = null
  onmessage: ((e: MessageEvent) => void) | null = null
  onclose: ((e: CloseEvent) => void) | null = null
  onerror: ((e: Event) => void) | null = null

  send = vi.fn()
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED
  })

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  simulateMessage(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }))
  }

  simulateClose(wasClean = true) {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.(new CloseEvent('close', { wasClean }))
  }

  simulateError() {
    this.onerror?.(new Event('error'))
  }
}

let instances: MockWebSocket[]

beforeEach(() => {
  instances = []
  class TrackingWebSocket extends MockWebSocket {
    constructor(url: string) {
      super()
      instances.push(this)
      void url
    }
  }
  vi.stubGlobal('WebSocket', TrackingWebSocket)
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' }),
    })
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

const getWs = () => {
  const ws = instances[0]
  if (!ws) throw new Error('WebSocket not yet created')
  return ws
}

const makeStation = (callsign = 'G4ABC') => ({
  callsign,
  coordinates: { latitude: 51.5, longitude: -0.1 },
  symbol: '-',
  symbolTable: '/',
  comment: '',
  lastHeard: new Date().toISOString(),
  packetCount: 1,
  distance: null,
  bearing: null,
  via: [],
})

const renderAndOpen = async () => {
  const hook = renderHook(() => useStations('ws://localhost/ws'))
  await waitFor(() => expect(instances.length).toBeGreaterThan(0))
  act(() => getWs().simulateOpen())
  await waitFor(() => expect(hook.result.current.connected).toBe(true))
  return hook
}

describe('useStations', () => {
  it('starts in loading state with no stations', async () => {
    const { result } = renderHook(() => useStations('ws://localhost/ws'))
    await waitFor(() => expect(instances.length).toBeGreaterThan(0))
    expect(result.current.loading).toBe(true)
    expect(result.current.stations).toEqual([])
    expect(result.current.connected).toBe(false)
  })

  it('sets connected true on WebSocket open', async () => {
    const { result } = await renderAndOpen()
    expect(result.current.connected).toBe(true)
  })

  it('sets error on WebSocket error', async () => {
    const { result } = await renderAndOpen()
    act(() => getWs().simulateError())
    await waitFor(() => expect(result.current.error).toBe('Connection error'))
  })

  it('sets connected false on close', async () => {
    const { result } = await renderAndOpen()
    act(() => getWs().simulateClose(true))
    await waitFor(() => expect(result.current.connected).toBe(false))
  })

  it('processes init: sets stations and clears loading', async () => {
    const { result } = await renderAndOpen()
    act(() =>
      getWs().simulateMessage({
        type: 'init',
        stations: [makeStation('G4ABC'), makeStation('M0XYZ')],
        stats: { totalStations: 2, stationsWithPosition: 2, totalPackets: 0, kissConnected: true },
      })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.stations).toHaveLength(2)
  })

  it('processes init: deduplicates stations keeping most recent', async () => {
    const { result } = await renderAndOpen()
    act(() =>
      getWs().simulateMessage({
        type: 'init',
        stations: [
          { ...makeStation('G4ABC'), lastHeard: '2024-01-01T10:00:00Z' },
          { ...makeStation('G4ABC'), lastHeard: '2024-01-01T12:00:00Z' },
        ],
        stats: { totalStations: 1, stationsWithPosition: 1, totalPackets: 0, kissConnected: true },
      })
    )
    await waitFor(() => expect(result.current.stations).toHaveLength(1))
  })

  it('fetches and merges a pinned station that is not in the bulk list', async () => {
    const pinned = {
      ...makeStation('M0LHA-7'),
      lastHeard: '2024-01-01T00:00:00Z',
    }
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.endsWith('/stations/M0LHA-7')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ station: pinned }),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'ok' }) })
    })

    const hook = renderHook(() => useStations('ws://localhost/ws', 'M0LHA-7'))
    await waitFor(() => expect(instances.length).toBeGreaterThan(0))
    act(() => getWs().simulateOpen())
    act(() =>
      getWs().simulateMessage({
        type: 'init',
        stations: [makeStation('G4ABC')],
        stats: { totalStations: 1, stationsWithPosition: 1, totalPackets: 0, kissConnected: true },
      })
    )

    await waitFor(() =>
      expect(hook.result.current.stations.map((s) => s.callsign).sort()).toEqual([
        'G4ABC',
        'M0LHA-7',
      ])
    )
  })

  it('only fetches a pinned station once even after subsequent renders', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    const hook = renderHook(() => useStations('ws://localhost/ws', 'M0LHA-7'))
    await waitFor(() => expect(instances.length).toBeGreaterThan(0))
    act(() => getWs().simulateOpen())
    act(() =>
      getWs().simulateMessage({
        type: 'init',
        stations: [makeStation('G4ABC')],
        stats: { totalStations: 1, stationsWithPosition: 1, totalPackets: 0, kissConnected: true },
      })
    )
    await waitFor(() => expect(hook.result.current.stations.length).toBeGreaterThan(0))
    // Trigger more renders by pushing station_updates; pin must not refetch.
    act(() =>
      getWs().simulateMessage({
        type: 'station_update',
        station: makeStation('K9XYZ'),
        isNew: true,
      })
    )
    await waitFor(() => expect(hook.result.current.stations.length).toBeGreaterThan(1))

    const pinnedDetailCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).endsWith('/stations/M0LHA-7')
    )
    expect(pinnedDetailCalls).toHaveLength(1)
  })

  it('processes init: sets kissConnected from stats', async () => {
    const { result } = await renderAndOpen()
    act(() =>
      getWs().simulateMessage({
        type: 'init',
        stations: [],
        stats: { totalStations: 0, stationsWithPosition: 0, totalPackets: 0, kissConnected: true },
      })
    )
    await waitFor(() => expect(result.current.kissConnected).toBe(true))
  })

  it('processes init: loads stationHistory map', async () => {
    const { result } = await renderAndOpen()
    act(() =>
      getWs().simulateMessage({
        type: 'init',
        stations: [makeStation('G4ABC')],
        stats: { totalStations: 1, stationsWithPosition: 1, totalPackets: 0, kissConnected: true },
        stationHistory: {
          G4ABC: [
            {
              raw: 'test',
              source: 'G4ABC',
              destination: '',
              timestamp: new Date().toISOString(),
              position: null,
            },
          ],
        },
      })
    )
    await waitFor(() => expect(result.current.stationHistory.get('G4ABC')).toHaveLength(1))
  })

  it('station_update: updates existing station', async () => {
    const { result } = await renderAndOpen()
    act(() =>
      getWs().simulateMessage({
        type: 'init',
        stations: [makeStation('G4ABC')],
        stats: { totalStations: 1, stationsWithPosition: 1, totalPackets: 0, kissConnected: true },
      })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() =>
      getWs().simulateMessage({
        type: 'station_update',
        station: { ...makeStation('G4ABC'), comment: 'updated' },
      })
    )
    await waitFor(() =>
      expect(result.current.stations.find((s) => s.callsign === 'G4ABC')?.comment).toBe('updated')
    )
  })

  it('station_update: prepends unknown station', async () => {
    const { result } = await renderAndOpen()
    act(() =>
      getWs().simulateMessage({
        type: 'init',
        stations: [makeStation('G4ABC')],
        stats: { totalStations: 1, stationsWithPosition: 1, totalPackets: 0, kissConnected: true },
      })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => getWs().simulateMessage({ type: 'station_update', station: makeStation('M0NEW') }))
    await waitFor(() => expect(result.current.stations).toHaveLength(2))
    expect(result.current.stations[0]?.callsign).toBe('M0NEW')
  })

  it('stats_update: updates stats', async () => {
    const { result } = await renderAndOpen()
    act(() =>
      getWs().simulateMessage({
        type: 'init',
        stations: [],
        stats: { totalStations: 0, stationsWithPosition: 0, totalPackets: 0, kissConnected: false },
      })
    )
    act(() =>
      getWs().simulateMessage({
        type: 'stats_update',
        stats: {
          totalStations: 5,
          stationsWithPosition: 3,
          totalPackets: 10,
          kissConnected: false,
        },
      })
    )
    await waitFor(() => expect(result.current.stats?.totalStations).toBe(5))
  })

  it('kiss_connected: sets kissConnected true', async () => {
    const { result } = await renderAndOpen()
    act(() => getWs().simulateMessage({ type: 'kiss_connected' }))
    await waitFor(() => expect(result.current.kissConnected).toBe(true))
  })

  it('kiss_disconnected: sets kissConnected false', async () => {
    const { result } = await renderAndOpen()
    act(() => getWs().simulateMessage({ type: 'kiss_connected' }))
    await waitFor(() => expect(result.current.kissConnected).toBe(true))
    act(() => getWs().simulateMessage({ type: 'kiss_disconnected' }))
    await waitFor(() => expect(result.current.kissConnected).toBe(false))
  })

  it('aprs_packet: appends to packets and station history', async () => {
    const { result } = await renderAndOpen()
    act(() =>
      getWs().simulateMessage({
        type: 'init',
        stations: [],
        stats: { totalStations: 0, stationsWithPosition: 0, totalPackets: 0, kissConnected: true },
      })
    )
    const packet = {
      raw: 'G4ABC>APRS:test',
      source: 'G4ABC',
      destination: 'APRS',
      path: '',
      comment: '',
      timestamp: new Date().toISOString(),
    }
    act(() => getWs().simulateMessage({ type: 'aprs_packet', packet }))
    await waitFor(() => expect(result.current.packets).toHaveLength(1))
    expect(result.current.stationHistory.get('G4ABC')).toHaveLength(1)
  })

  it('ignores malformed JSON without throwing', async () => {
    const { result } = await renderAndOpen()
    act(() => {
      getWs().onmessage?.(new MessageEvent('message', { data: 'not-json{{{' }))
    })
    expect(result.current.loading).toBe(true)
  })
})
