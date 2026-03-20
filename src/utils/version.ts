import packageJson from '../../package.json'

export const CLIENT_VERSION = packageJson.version

export interface VersionInfo {
  version: string
  commit: string
  branch: string
  buildTime: string
}

let initialBuildTime: string | null = null

export const checkVersion = async (): Promise<boolean> => {
  try {
    const response = await fetch(`/api/version?t=${Date.now()}`)
    if (!response.ok) return true

    const serverVersion: VersionInfo = await response.json()

    if (initialBuildTime === null) {
      initialBuildTime = serverVersion.buildTime
      console.log(`[Version] Initial build time: ${initialBuildTime}`)
      return true
    }

    const hasNewVersion = serverVersion.buildTime !== initialBuildTime

    if (hasNewVersion) {
      console.log(
        `[Version] New version detected! Old: ${initialBuildTime}, New: ${serverVersion.buildTime}`
      )
    }

    return !hasNewVersion
  } catch (error) {
    console.error('[Version] Failed to check version:', error)
    return true
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

  checkVersion()
  const intervalId = setInterval(checkAndReload, intervalMs)
  return () => clearInterval(intervalId)
}
