import { describe, expect, it } from 'vitest'
import connectionReducer, {
  resetConnection,
  setConnected,
  setKissConnected,
} from './connection-slice'

const initial = { connected: false, kissConnected: false }

describe('connectionSlice', () => {
  it('has correct initial state', () => {
    expect(connectionReducer(undefined, { type: '@@init' })).toEqual(initial)
  })

  it('setConnected sets connected to true', () => {
    expect(connectionReducer(undefined, setConnected(true)).connected).toBe(true)
  })

  it('setConnected sets connected to false', () => {
    expect(
      connectionReducer({ connected: true, kissConnected: false }, setConnected(false)).connected
    ).toBe(false)
  })

  it('setKissConnected sets kissConnected', () => {
    expect(connectionReducer(undefined, setKissConnected(true)).kissConnected).toBe(true)
  })

  it('resetConnection restores initial state', () => {
    expect(connectionReducer({ connected: true, kissConnected: true }, resetConnection())).toEqual(
      initial
    )
  })
})
