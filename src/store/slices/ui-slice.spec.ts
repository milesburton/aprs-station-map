import { describe, expect, it } from 'vitest'
import uiReducer, {
  resetUserResize,
  setActiveTab,
  setDiagnosticsHeight,
  setDiagnosticsOpen,
  setSpectrumPoppedOut,
  TAB_HEIGHT_CONSTRAINTS,
  TAB_HEIGHTS,
  toggleDiagnostics,
} from './ui-slice'

describe('uiSlice', () => {
  it('has diagnosticsOpen false initially', () => {
    expect(uiReducer(undefined, { type: '@@init' }).diagnosticsOpen).toBe(false)
  })

  it('toggleDiagnostics opens closed panel', () => {
    expect(uiReducer(undefined, toggleDiagnostics()).diagnosticsOpen).toBe(true)
  })

  it('toggleDiagnostics closes open panel', () => {
    const open = uiReducer(undefined, setDiagnosticsOpen(true))
    expect(uiReducer(open, toggleDiagnostics()).diagnosticsOpen).toBe(false)
  })

  it('setDiagnosticsOpen sets diagnosticsOpen directly', () => {
    expect(uiReducer(undefined, setDiagnosticsOpen(true)).diagnosticsOpen).toBe(true)
  })

  it('setDiagnosticsHeight updates height and marks user-resized', () => {
    const state = uiReducer(undefined, setDiagnosticsHeight(250))
    expect(state.diagnosticsHeight).toBe(250)
    expect(state.userResizedHeight).toBe(true)
  })

  it('setActiveTab changes active tab and uses default height when not user-resized', () => {
    const state = uiReducer(undefined, setActiveTab('packets'))
    expect(state.activeTab).toBe('packets')
    expect(state.diagnosticsHeight).toBe(TAB_HEIGHTS.packets)
  })

  it('setActiveTab clamps height to tab constraints when user has resized', () => {
    const withResize = uiReducer(undefined, setDiagnosticsHeight(500))
    const state = uiReducer(withResize, setActiveTab('status'))
    expect(state.diagnosticsHeight).toBe(TAB_HEIGHT_CONSTRAINTS.status.max)
  })

  it('setActiveTab clamps height to min when below minimum', () => {
    const withResize = uiReducer(undefined, setDiagnosticsHeight(20))
    const state = uiReducer(withResize, setActiveTab('status'))
    expect(state.diagnosticsHeight).toBe(TAB_HEIGHT_CONSTRAINTS.status.min)
  })

  it('resetUserResize restores default height and clears flag', () => {
    const resized = uiReducer(undefined, setDiagnosticsHeight(300))
    const state = uiReducer(resized, resetUserResize())
    expect(state.userResizedHeight).toBe(false)
    expect(state.diagnosticsHeight).toBe(TAB_HEIGHTS.stats)
  })

  it('setSpectrumPoppedOut sets the flag', () => {
    expect(uiReducer(undefined, setSpectrumPoppedOut(true)).spectrumPoppedOut).toBe(true)
  })
})
