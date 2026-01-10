import packageJson from '../../package.json'

export const CLIENT_VERSION = packageJson.version

export interface VersionInfo {
  version: string
  buildDate: string
}

export const checkVersion = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/version')
    const serverVersion: VersionInfo = await response.json()

    console.log(`[Version] Client: ${CLIENT_VERSION}, Server: ${serverVersion.version}`)

    return CLIENT_VERSION === serverVersion.version
  } catch (error) {
    console.error('[Version] Failed to check version:', error)
    return true // Assume versions match if check fails
  }
}

export const setupVersionCheck = (intervalMs = 30000): (() => void) => {
  const checkAndReload = async () => {
    const versionsMatch = await checkVersion()
    if (!versionsMatch) {
      console.log('[Version] New version detected, reloading...')
      // Show a notification before reloading
      if (confirm('A new version is available. Reload to update?')) {
        window.location.reload()
      }
    }
  }

  // Don't check immediately on mount - wait for interval
  // This prevents reload loops
  const intervalId = setInterval(checkAndReload, intervalMs)

  // Return cleanup function
  return () => clearInterval(intervalId)
}
