import packageJson from '../../package.json'

export const CLIENT_VERSION = packageJson.version

export interface VersionInfo {
  version: string
  commit: string
  branch: string
  buildTime: string
}

// Store the initial build time when the app loads
let initialBuildTime: string | null = null

export const checkVersion = async (): Promise<boolean> => {
  try {
    // Add cache-busting query param to avoid browser caching
    const response = await fetch(`/version.json?t=${Date.now()}`)
    if (!response.ok) return true // Assume match if fetch fails

    const serverVersion: VersionInfo = await response.json()

    // On first check, store the build time
    if (initialBuildTime === null) {
      initialBuildTime = serverVersion.buildTime
      console.log(`[Version] Initial build time: ${initialBuildTime}`)
      return true
    }

    // Compare build times - if server has newer build, reload
    const hasNewVersion = serverVersion.buildTime !== initialBuildTime

    if (hasNewVersion) {
      console.log(
        `[Version] New version detected! Old: ${initialBuildTime}, New: ${serverVersion.buildTime}`
      )
    }

    return !hasNewVersion
  } catch (error) {
    console.error('[Version] Failed to check version:', error)
    return true // Assume versions match if check fails
  }
}

export const setupVersionCheck = (intervalMs = 30000): (() => void) => {
  const checkAndReload = async () => {
    const versionsMatch = await checkVersion()
    if (!versionsMatch) {
      console.log('[Version] Reloading to get new version...')
      window.location.reload()
    }
  }

  // Check immediately to capture the initial build time
  checkVersion()

  // Then check periodically
  const intervalId = setInterval(checkAndReload, intervalMs)

  // Return cleanup function
  return () => clearInterval(intervalId)
}
