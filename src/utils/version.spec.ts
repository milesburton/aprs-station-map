import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLIENT_VERSION, checkVersion, setupVersionCheck } from './version'

describe('version', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('CLIENT_VERSION', () => {
    it('should be defined', () => {
      expect(CLIENT_VERSION).toBeDefined()
      expect(typeof CLIENT_VERSION).toBe('string')
    })
  })

  describe('checkVersion', () => {
    it('should return true when versions match', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ version: CLIENT_VERSION, buildDate: '2024-01-01' }),
      })

      const result = await checkVersion()
      expect(result).toBe(true)
      expect(fetch).toHaveBeenCalledWith('/api/version')
    })

    it('should return false when versions do not match', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ version: '0.0.0', buildDate: '2024-01-01' }),
      })

      const result = await checkVersion()
      expect(result).toBe(false)
    })

    it('should return true when fetch fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const result = await checkVersion()
      expect(result).toBe(true)
    })
  })

  describe('setupVersionCheck', () => {
    it('should return a cleanup function', () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ version: CLIENT_VERSION, buildDate: '2024-01-01' }),
      })

      const cleanup = setupVersionCheck(1000)
      expect(typeof cleanup).toBe('function')
      cleanup()
    })

    it('should call checkVersion at the specified interval', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ version: CLIENT_VERSION, buildDate: '2024-01-01' }),
      })

      const cleanup = setupVersionCheck(1000)

      expect(fetch).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1000)
      expect(fetch).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(1000)
      expect(fetch).toHaveBeenCalledTimes(2)

      cleanup()
    })

    it('should show confirm dialog when version mismatch detected', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ version: '0.0.0', buildDate: '2024-01-01' }),
      })
      global.confirm = vi.fn().mockReturnValue(false)

      const cleanup = setupVersionCheck(1000)

      await vi.advanceTimersByTimeAsync(1000)

      expect(confirm).toHaveBeenCalledWith('A new version is available. Reload to update?')
      cleanup()
    })

    it('should reload page when user confirms', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ version: '0.0.0', buildDate: '2024-01-01' }),
      })
      global.confirm = vi.fn().mockReturnValue(true)

      const reloadMock = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { reload: reloadMock },
        writable: true,
      })

      const cleanup = setupVersionCheck(1000)

      await vi.advanceTimersByTimeAsync(1000)

      expect(reloadMock).toHaveBeenCalled()
      cleanup()
    })

    it('should stop checking after cleanup is called', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ version: CLIENT_VERSION, buildDate: '2024-01-01' }),
      })

      const cleanup = setupVersionCheck(1000)
      cleanup()

      await vi.advanceTimersByTimeAsync(5000)
      expect(fetch).not.toHaveBeenCalled()
    })
  })
})
