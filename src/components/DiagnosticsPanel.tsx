import type { FC } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getStationStats } from '../services'
import type { AprsPacket, Station, Stats } from '../types'
import { formatDistance, formatRelativeTime } from '../utils'
import { CLIENT_VERSION } from '../utils/version'
import { SpectrumAnalyzer } from './SpectrumAnalyzer'

const PANEL_HEIGHT_KEY = 'aprs-diagnostics-panel-height'
const DEFAULT_HEIGHT = 288
const MIN_HEIGHT = 150
const MAX_HEIGHT = 600
const COLLAPSED_HEIGHT = 40

declare const __BUILD_TIME__: string

type TabId = 'stats' | 'packets' | 'spectrum' | 'status' | 'about'

// Reusable Tab component with proper accessibility
const Tab: FC<{ label: string; active: boolean; onClick: () => void }> = ({
  label,
  active,
  onClick,
}) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    onClick={onClick}
    className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
      active
        ? 'bg-slate-900 text-blue-400 border border-slate-700 border-b-slate-900'
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
    }`}
  >
    {label}
  </button>
)

// Reusable action button
const ActionButton: FC<{
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'success'
  children: React.ReactNode
}> = ({ onClick, disabled, variant = 'primary', children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
      variant === 'success'
        ? 'bg-green-600 hover:bg-green-500 text-white'
        : 'bg-blue-600 hover:bg-blue-500 text-white'
    }`}
  >
    {children}
  </button>
)

// Status indicator badge
const StatusBadge: FC<{ success: boolean; label: string }> = ({ success, label }) => (
  <span
    className={`px-2 py-0.5 rounded text-xs font-medium ${
      success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
    }`}
  >
    {success ? '●' : '○'} {label}
  </span>
)

// Compact stat card
const StatCard: FC<{ value: string | number; label: string; color?: string }> = ({
  value,
  label,
  color = 'text-white',
}) => (
  <div className="bg-slate-800 rounded p-3 min-w-[100px]">
    <div className={`text-xl font-bold ${color}`}>{value}</div>
    <div className="text-xs text-slate-400 mt-0.5">{label}</div>
  </div>
)

const KissTncHelp: FC = () => (
  <div className="bg-slate-800 border-l-2 border-red-500 p-3 text-xs rounded-r">
    <h4 className="text-slate-100 font-medium mb-1">KISS TNC Not Connected</h4>
    <ul className="text-slate-400 list-disc pl-4 space-y-0.5">
      <li>Direwolf TNC service is not running</li>
      <li>Audio device configuration issue</li>
    </ul>
    <p className="text-slate-400 mt-2">
      Check: <code className="bg-slate-700 px-1 rounded text-blue-400">docker compose logs -f</code>
    </p>
  </div>
)

const AwaitingPacketsInfo: FC = () => (
  <div className="bg-slate-800 border-l-2 border-blue-500 p-3 text-xs rounded-r">
    <h4 className="text-slate-100 font-medium mb-1">Listening for APRS Packets</h4>
    <p className="text-slate-400">System ready, waiting for RF signals on 144.800 MHz.</p>
  </div>
)

const formatPacketType = (type?: string) => {
  const types: Record<string, string> = {
    position: '📍',
    status: '📝',
    message: '💬',
    telemetry: '📊',
    weather: '🌤️',
  }
  return types[type ?? ''] ?? '❓'
}

const formatPosition = (position?: AprsPacket['position']) => {
  if (!position) return '-'
  return `${position.latitude.toFixed(4)}°, ${position.longitude.toFixed(4)}°`
}

const exportPacketsToCsv = (packets: AprsPacket[]) => {
  const headers = ['Time', 'Source', 'Destination', 'Type', 'Path', 'Position', 'Comment', 'Raw']
  const rows = packets.map((p) => [
    new Date(p.timestamp).toISOString(),
    p.source,
    p.destination,
    p.type ?? 'unknown',
    p.path ?? '',
    p.position ? `${p.position.latitude},${p.position.longitude}` : '',
    p.comment ?? '',
    p.raw.replace(/"/g, '""'),
  ])

  const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join(
    '\n'
  )
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `aprs-packets-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// Tab Content: Packets
const PacketsTab: FC<{ packets: AprsPacket[] }> = ({ packets }) => {
  if (packets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 p-4">
        <div className="text-center">
          <p className="text-sm mb-1">No packets received yet</p>
          <p className="text-xs">Packets will appear here as they are decoded</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700 bg-slate-800/50 shrink-0">
        <span className="text-xs text-slate-400">{packets.length} packets</span>
        <ActionButton variant="success" onClick={() => exportPacketsToCsv(packets)}>
          Export CSV
        </ActionButton>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-800 sticky top-0">
            <tr className="text-left text-slate-400">
              <th className="px-2 py-1.5 font-medium">Time</th>
              <th className="px-2 py-1.5 font-medium">Source</th>
              <th className="px-2 py-1.5 font-medium">Dest</th>
              <th className="px-2 py-1.5 font-medium w-8">Type</th>
              <th className="px-2 py-1.5 font-medium">Position</th>
              <th className="px-2 py-1.5 font-medium">Comment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {[...packets].reverse().map((packet, index) => (
              <tr key={`${packet.timestamp}-${index}`} className="hover:bg-slate-800/50">
                <td className="px-2 py-1 text-slate-400 whitespace-nowrap">
                  {formatRelativeTime(new Date(packet.timestamp))}
                </td>
                <td className="px-2 py-1 text-green-400 font-mono font-medium">{packet.source}</td>
                <td className="px-2 py-1 text-slate-300 font-mono">{packet.destination}</td>
                <td className="px-2 py-1 text-center" title={packet.type}>
                  {formatPacketType(packet.type)}
                </td>
                <td className="px-2 py-1 text-blue-400 font-mono">
                  {formatPosition(packet.position)}
                </td>
                <td
                  className="px-2 py-1 text-slate-400 max-w-[200px] truncate"
                  title={packet.comment}
                >
                  {packet.comment || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Tab Content: Status
interface StatusTabProps {
  connected: boolean
  stats: Stats | null
  lastPacketTime: Date | null
  statusText: string
}

const StatusTab: FC<StatusTabProps> = ({ connected, stats, lastPacketTime, statusText }) => {
  const showKissHelp = stats !== null && !stats.kissConnected
  const showAwaitingInfo = stats?.kissConnected && stats.totalPackets === 0

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      <div className="bg-slate-800 rounded p-3">
        <h4 className="text-xs font-medium text-slate-100 mb-2">Service Status</h4>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between items-center py-1.5 px-2 bg-slate-900 rounded">
            <span className="text-slate-400">WebSocket</span>
            <StatusBadge success={connected} label={connected ? 'Connected' : 'Disconnected'} />
          </div>
          <div className="flex justify-between items-center py-1.5 px-2 bg-slate-900 rounded">
            <span className="text-slate-400">KISS TNC</span>
            <StatusBadge
              success={stats?.kissConnected ?? false}
              label={stats?.kissConnected ? 'Connected' : 'Disconnected'}
            />
          </div>
          <div className="flex justify-between items-center py-1.5 px-2 bg-slate-900 rounded">
            <span className="text-slate-400">Status</span>
            <span className="text-slate-100">{statusText}</span>
          </div>
          {lastPacketTime && (
            <div className="flex justify-between items-center py-1.5 px-2 bg-slate-900 rounded">
              <span className="text-slate-400">Last Packet</span>
              <span className="text-slate-100">{formatRelativeTime(lastPacketTime)}</span>
            </div>
          )}
        </div>
      </div>

      {stats && (
        <div className="bg-slate-800 rounded p-3">
          <h4 className="text-xs font-medium text-slate-100 mb-2">Statistics</h4>
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-slate-900 rounded p-2 text-center">
              <div className="text-lg font-bold text-blue-400">{stats.totalStations}</div>
              <div className="text-xs text-slate-400">Stations</div>
            </div>
            <div className="bg-slate-900 rounded p-2 text-center">
              <div className="text-lg font-bold text-green-400">{stats.stationsWithPosition}</div>
              <div className="text-xs text-slate-400">With Pos</div>
            </div>
            <div className="bg-slate-900 rounded p-2 text-center">
              <div className="text-lg font-bold text-purple-400">{stats.totalPackets}</div>
              <div className="text-xs text-slate-400">Packets</div>
            </div>
            <div className="bg-slate-900 rounded p-2 text-center">
              <div className="text-lg font-bold text-orange-400">144.8</div>
              <div className="text-xs text-slate-400">MHz</div>
            </div>
          </div>
        </div>
      )}

      {showKissHelp && <KissTncHelp />}
      {showAwaitingInfo && <AwaitingPacketsInfo />}
    </div>
  )
}

// Tab Content: About
const AboutTab: FC = () => {
  const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? new Date(__BUILD_TIME__) : null

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      <div className="bg-slate-800 rounded p-3">
        <h4 className="text-xs font-medium text-slate-100 mb-2">APRS Station Map</h4>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between py-1 border-b border-slate-700">
            <span className="text-slate-400">Version</span>
            <span className="text-slate-100 font-mono">{CLIENT_VERSION}</span>
          </div>
          {buildTime && (
            <div className="flex justify-between py-1 border-b border-slate-700">
              <span className="text-slate-400">Build Time</span>
              <span className="text-slate-100 font-mono">{buildTime.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between py-1 border-b border-slate-700">
            <span className="text-slate-400">Frequency</span>
            <span className="text-slate-100 font-mono">144.800 MHz</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-400">Protocol</span>
            <span className="text-slate-100 font-mono">APRS (AX.25)</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded p-3">
        <h4 className="text-xs font-medium text-slate-100 mb-2">Components</h4>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between py-1 border-b border-slate-700">
            <span className="text-slate-400">TNC</span>
            <span className="text-slate-100">Direwolf</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-700">
            <span className="text-slate-400">Frontend</span>
            <span className="text-slate-100">React + Leaflet</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-400">Backend</span>
            <span className="text-slate-100">Node.js + WebSocket</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Tab Content: Stats
interface StatsTabProps {
  stations: Station[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  onRefresh: () => void
}

const StatsTab: FC<StatsTabProps> = ({ stations, loading, error, lastUpdated, onRefresh }) => {
  const { total, avgDistance, furthest } = getStationStats(stations)

  return (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="flex gap-2 flex-wrap mb-3">
        <StatCard value={total} label="Stations" color="text-blue-400" />
        {total > 0 && (
          <>
            <StatCard
              value={formatDistance(avgDistance)}
              label="Avg Distance"
              color="text-green-400"
            />
            {furthest && furthest.distance != null && (
              <StatCard
                value={furthest.callsign}
                label={`Furthest (${formatDistance(furthest.distance)})`}
                color="text-purple-400"
              />
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs">
        <ActionButton onClick={onRefresh} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </ActionButton>
        {lastUpdated && (
          <span className="text-slate-400">Updated {formatRelativeTime(lastUpdated)}</span>
        )}
        {error && <span className="text-red-400">{error}</span>}
      </div>
    </div>
  )
}

// Main Panel Component
interface DiagnosticsPanelProps {
  packets: AprsPacket[]
  stats: Stats | null
  connected: boolean
  isOpen: boolean
  onToggle: () => void
  stations: Station[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  onRefresh: () => void
}

export const DiagnosticsPanel: FC<DiagnosticsPanelProps> = ({
  packets,
  stats,
  connected,
  isOpen,
  onToggle,
  stations,
  loading,
  error,
  lastUpdated,
  onRefresh,
}) => {
  const [lastPacketTime, setLastPacketTime] = useState<Date | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('stats')
  const [panelHeight, setPanelHeight] = useState(() => {
    const saved = localStorage.getItem(PANEL_HEIGHT_KEY)
    return saved ? Number.parseInt(saved, 10) : DEFAULT_HEIGHT
  })
  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (packets.length > 0) {
      const lastPacket = packets[packets.length - 1]
      if (lastPacket) {
        setLastPacketTime(new Date(lastPacket.timestamp))
      }
    }
  }, [packets])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const windowHeight = window.innerHeight
      const newHeight = windowHeight - e.clientY
      const clampedHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, newHeight))
      setPanelHeight(clampedHeight)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      localStorage.setItem(PANEL_HEIGHT_KEY, panelHeight.toString())
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, panelHeight])

  const getStatusIndicator = () => {
    if (!connected) return '🔴'
    if (stats !== null && !stats.kissConnected) return '🟡'
    return '🟢'
  }

  const getStatusText = () => {
    if (!connected) return 'Disconnected'
    if (stats !== null && !stats.kissConnected) return 'TNC Disconnected'
    if (stats === null) return 'Connecting...'
    if (packets.length === 0) return 'Awaiting Packets'
    return `Receiving (${packets.length})`
  }

  const currentHeight = isOpen ? panelHeight : COLLAPSED_HEIGHT
  const tabs: { id: TabId; label: string }[] = [
    { id: 'stats', label: 'Stats' },
    { id: 'packets', label: 'Packets' },
    { id: 'spectrum', label: 'Spectrum' },
    { id: 'status', label: 'Status' },
    { id: 'about', label: 'About' },
  ]

  return (
    <div
      ref={panelRef}
      style={{ height: currentHeight }}
      className={`shrink-0 flex flex-col bg-slate-900 border-t border-slate-700 overflow-hidden ${isResizing ? 'select-none' : ''}`}
    >
      {/* Resize handle */}
      {isOpen && (
        // biome-ignore lint/a11y/noStaticElementInteractions: resize handle is mouse-only
        <div
          className="h-1 bg-slate-700 hover:bg-blue-500 cursor-ns-resize transition-colors shrink-0"
          onMouseDown={handleMouseDown}
        />
      )}

      {/* Header bar with toggle */}
      <div className="flex items-center justify-between px-3 h-9 min-h-[36px] bg-slate-800 border-b border-slate-700 shrink-0">
        <button type="button" onClick={onToggle} className="flex items-center gap-2 text-xs">
          <span>{getStatusIndicator()}</span>
          <span className="font-medium text-slate-100">Diagnostics</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">{getStatusText()}</span>
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          {isOpen ? '▼' : '▲'}
        </button>
      </div>

      {isOpen && (
        <>
          {/* Tab bar */}
          <div
            role="tablist"
            className="flex gap-1 border-b border-slate-700 bg-slate-800 px-2 pt-1 shrink-0"
          >
            {tabs.map((tab) => (
              <Tab
                key={tab.id}
                label={tab.label}
                active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              />
            ))}
          </div>

          {/* Tab content */}
          <div role="tabpanel" className="flex-1 flex flex-col overflow-hidden bg-slate-900">
            {activeTab === 'stats' && (
              <StatsTab
                stations={stations}
                loading={loading}
                error={error}
                lastUpdated={lastUpdated}
                onRefresh={onRefresh}
              />
            )}
            {activeTab === 'packets' && <PacketsTab packets={packets} />}
            {activeTab === 'spectrum' && (
              <div className="flex-1 overflow-y-auto p-3">
                <SpectrumAnalyzer />
              </div>
            )}
            {activeTab === 'status' && (
              <StatusTab
                connected={connected}
                stats={stats}
                lastPacketTime={lastPacketTime}
                statusText={getStatusText()}
              />
            )}
            {activeTab === 'about' && <AboutTab />}
          </div>
        </>
      )}
    </div>
  )
}
