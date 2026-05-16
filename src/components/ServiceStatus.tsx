import type { FC } from 'react'
import type { HealthStatus } from '../types'

interface ServiceStatusProps {
  loading: boolean
  connected: boolean
  health: HealthStatus | null
}

export const ServiceStatus: FC<ServiceStatusProps> = ({ loading, connected, health }) => {
  // If health confirms the server is healthy, don't block on WS connection state
  const serverHealthy = health?.healthy === true
  const isStartingUp = loading && !connected && !serverHealthy
  const isDown = !loading && !connected && health !== null && !health.healthy

  if (!isStartingUp && !isDown) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900">
      <div className="text-center max-w-sm px-6">
        {isStartingUp ? (
          <>
            <div className="mb-4 text-4xl">📡</div>
            <h1 className="text-xl font-semibold text-slate-100 mb-2">Starting up&hellip;</h1>
            <p className="text-slate-400 text-sm">
              The server is waking up. This usually takes 10&ndash;20 seconds.
            </p>
            <div className="mt-6 flex justify-center gap-1">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce [animation-delay:300ms]" />
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 text-4xl">⚠️</div>
            <h1 className="text-xl font-semibold text-slate-100 mb-2">Service degraded</h1>
            <p className="text-slate-400 text-sm mb-4">
              The server is running but not receiving APRS data. It may still be connecting.
            </p>
            {health && (
              <div className="text-left bg-slate-800 rounded-lg p-3 text-xs text-slate-400 space-y-1">
                <div>
                  Source connected:{' '}
                  <span className={health.sourceConnected ? 'text-green-400' : 'text-red-400'}>
                    {health.sourceConnected ? 'yes' : 'no'}
                  </span>
                </div>
                <div>
                  Receiving packets:{' '}
                  <span className={health.receivingPackets ? 'text-green-400' : 'text-red-400'}>
                    {health.receivingPackets ? 'yes' : 'no'}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
