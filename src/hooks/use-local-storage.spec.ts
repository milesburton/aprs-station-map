import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocalStorage } from './use-local-storage'

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns initial value when nothing is stored', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 42))
    expect(result.current[0]).toBe(42)
  })

  it('returns stored value when key exists', () => {
    localStorage.setItem('test-key', JSON.stringify(99))
    const { result } = renderHook(() => useLocalStorage('test-key', 0))
    expect(result.current[0]).toBe(99)
  })

  it('stores value in localStorage on setValue', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 0))
    act(() => result.current[1](123))
    expect(localStorage.getItem('test-key')).toBe('123')
    expect(result.current[0]).toBe(123)
  })

  it('works with object values', () => {
    const { result } = renderHook(() => useLocalStorage<{ x: number }>('obj-key', { x: 1 }))
    act(() => result.current[1]({ x: 42 }))
    expect(result.current[0]).toEqual({ x: 42 })
  })

  it('returns initial value when stored JSON is invalid', () => {
    localStorage.setItem('bad-key', 'not-json{{{')
    const { result } = renderHook(() => useLocalStorage('bad-key', 'default'))
    expect(result.current[0]).toBe('default')
  })

  it('updates state on storage event for matching key', () => {
    const { result } = renderHook(() => useLocalStorage('shared-key', 'initial'))

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'shared-key', newValue: JSON.stringify('updated') })
      )
    })

    expect(result.current[0]).toBe('updated')
  })

  it('ignores storage events for different keys', () => {
    const { result } = renderHook(() => useLocalStorage('my-key', 'initial'))

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'other-key', newValue: JSON.stringify('changed') })
      )
    })

    expect(result.current[0]).toBe('initial')
  })

  it('falls back to initial value when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage error')
    })
    const { result } = renderHook(() => useLocalStorage('err-key', 'fallback'))
    expect(result.current[0]).toBe('fallback')
  })
})
