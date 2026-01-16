import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLIENT_VERSION, checkVersion } from './version'

// We need to reset the module state between tests since initialBuildTime is stored
const resetVersionModule = async () => {
  vi.resetModules()
  const module = await import('./version')
  return module
}

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
    it('should return true on first call (stores initial build time)', async () => {
      const { checkVersion: check } = await resetVersionModule()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '1.0.0', buildTime: '2024-01-01T00:00:00Z' }),
      })

      const result = await check()
      expect(result).toBe(true)
      expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/^\/version\.json\?t=\d+$/))
    })

    it('should return true when build times match', async () => {
      const { checkVersion: check } = await resetVersionModule()

      const buildTime = '2024-01-01T00:00:00Z'
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '1.0.0', buildTime }),
      })

      // First call stores initial build time
      await check()
      // Second call compares
      const result = await check()
      expect(result).toBe(true)
    })

    it('should return false when build times differ', async () => {
      const { checkVersion: check } = await resetVersionModule()

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ version: '1.0.0', buildTime: '2024-01-01T00:00:00Z' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ version: '1.0.1', buildTime: '2024-01-02T00:00:00Z' }),
        })

      // First call stores initial build time
      await check()
      // Second call detects different build time
      const result = await check()
      expect(result).toBe(false)
    })

    it('should return true when fetch fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const result = await checkVersion()
      expect(result).toBe(true)
    })

    it('should return true when response is not ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      })

      const result = await checkVersion()
      expect(result).toBe(true)
    })
  })

  describe('setupVersionCheck', () => {
    it('should return a cleanup function', async () => {
      const { setupVersionCheck: setup } = await resetVersionModule()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '1.0.0', buildTime: '2024-01-01T00:00:00Z' }),
      })

      const cleanup = setup(1000)
      expect(typeof cleanup).toBe('function')
      cleanup()
    })

    it('should call checkVersion immediately to store initial build time', async () => {
      const { setupVersionCheck: setup } = await resetVersionModule()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '1.0.0', buildTime: '2024-01-01T00:00:00Z' }),
      })

      const cleanup = setup(1000)

      // Should be called immediately (not waiting for interval)
      expect(fetch).toHaveBeenCalledTimes(1)

      cleanup()
    })

    it('should call checkVersion at the specified interval', async () => {
      const { setupVersionCheck: setup } = await resetVersionModule()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '1.0.0', buildTime: '2024-01-01T00:00:00Z' }),
      })

      const cleanup = setup(1000)

      // Initial call
      expect(fetch).toHaveBeenCalledTimes(1)

      // After first interval
      await vi.advanceTimersByTimeAsync(1000)
      expect(fetch).toHaveBeenCalledTimes(2)

      // After second interval
      await vi.advanceTimersByTimeAsync(1000)
      expect(fetch).toHaveBeenCalledTimes(3)

      cleanup()
    })

    it('should reload page when version mismatch detected', async () => {
      const { setupVersionCheck: setup } = await resetVersionModule()

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ version: '1.0.0', buildTime: '2024-01-01T00:00:00Z' }),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ version: '1.0.1', buildTime: '2024-01-02T00:00:00Z' }),
        })

      const reloadMock = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { reload: reloadMock },
        writable: true,
      })

      const cleanup = setup(1000)

      // First call stores initial build time
      expect(fetch).toHaveBeenCalledTimes(1)

      // After interval, detects new version and reloads
      await vi.advanceTimersByTimeAsync(1000)

      expect(reloadMock).toHaveBeenCalled()
      cleanup()
    })

    it('should stop checking after cleanup is called', async () => {
      const { setupVersionCheck: setup } = await resetVersionModule()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '1.0.0', buildTime: '2024-01-01T00:00:00Z' }),
      })

      const cleanup = setup(1000)

      // Initial call
      expect(fetch).toHaveBeenCalledTimes(1)

      cleanup()

      // Clear mock to check no more calls
      vi.mocked(fetch).mockClear()

      await vi.advanceTimersByTimeAsync(5000)
      expect(fetch).not.toHaveBeenCalled()
    })
  })
})
