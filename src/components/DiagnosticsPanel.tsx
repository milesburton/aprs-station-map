import type { FC } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getStationStats } from '../services'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  setActiveTab,
  setDiagnosticsHeight,
  TAB_HEIGHT_CONSTRAINTS,
  type TabId,
} from '../store/slices/uiSlice'
import type { AprsPacket, Station, Stats } from '../types'
import { formatDistance, formatRelativeTime } from '../utils'
import { CLIENT_VERSION } from '../utils/version'
import { SpectrumAnalyzer } from './SpectrumAnalyzer'

const COLLAPSED_HEIGHT = 24

declare const __BUILD_TIME__: string

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
    className={`diag-tab ${active ? 'active' : ''}`}
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
    className={`diag-btn ${variant === 'success' ? 'diag-btn-success' : 'diag-btn-primary'}`}
  >
    {children}
  </button>
)

// Compact stat card
const StatCard: FC<{
  value: string | number
  label: string
  color?: 'blue' | 'green' | 'purple'
}> = ({ value, label, color = 'blue' }) => (
  <div className="diag-stat-card">
    <div className={`diag-stat-value diag-stat-${color}`}>{value}</div>
    <div className="diag-stat-label">{label}</div>
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

// Status indicator for inline display
const StatusIndicator: FC<{ success: boolean; label: string }> = ({ success, label }) => (
  <span className={`diag-status-badge ${success ? 'success' : 'error'}`}>
    {success ? '●' : '○'} {label}
  </span>
)

// Tab Content: Status
interface StatusTabProps {
  connected: boolean
  kissConnected: boolean
  stats: Stats | null
  lastPacketTime: Date | null
  statusText: string
}

const StatusTab: FC<StatusTabProps> = ({
  connected,
  kissConnected,
  stats,
  lastPacketTime,
  statusText,
}) => (
  <div className="diag-status-content">
    <div className="diag-status-row">
      <span className="diag-status-label">WebSocket</span>
      <StatusIndicator success={connected} label={connected ? 'Connected' : 'Disconnected'} />
    </div>
    <div className="diag-status-row">
      <span className="diag-status-label">KISS TNC</span>
      <StatusIndicator
        success={kissConnected}
        label={kissConnected ? 'Connected' : 'Disconnected'}
      />
    </div>
    <div className="diag-status-row">
      <span className="diag-status-label">Status</span>
      <span className="diag-status-value">{statusText}</span>
    </div>
    {lastPacketTime && (
      <div className="diag-status-row">
        <span className="diag-status-label">Last Packet</span>
        <span className="diag-status-value">{formatRelativeTime(lastPacketTime)}</span>
      </div>
    )}
    {stats && (
      <>
        <div className="diag-status-divider" />
        <div className="diag-status-row">
          <span className="diag-status-label">Stations</span>
          <span className="diag-status-value diag-status-blue">{stats.totalStations}</span>
        </div>
        <div className="diag-status-row">
          <span className="diag-status-label">With Position</span>
          <span className="diag-status-value diag-status-green">{stats.stationsWithPosition}</span>
        </div>
        <div className="diag-status-row">
          <span className="diag-status-label">Packets</span>
          <span className="diag-status-value diag-status-purple">{stats.totalPackets}</span>
        </div>
      </>
    )}
  </div>
)

// About info item component
const AboutItem: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="diag-about-item">
    <span className="diag-about-label">{label}</span>
    <span className="diag-about-value">{value}</span>
  </div>
)

// Tab Content: About
const AboutTab: FC = () => {
  const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? new Date(__BUILD_TIME__) : null

  return (
    <div className="diag-about-content">
      <AboutItem label="Version" value={CLIENT_VERSION} />
      {buildTime && <AboutItem label="Built" value={buildTime.toLocaleString()} />}
      <AboutItem label="Frequency" value="144.800 MHz" />
      <AboutItem label="Protocol" value="APRS (AX.25)" />
      <div className="diag-about-divider" />
      <AboutItem label="TNC" value="Direwolf" />
      <AboutItem label="Frontend" value="React + Leaflet" />
      <AboutItem label="Backend" value="Node.js + WebSocket" />
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
    <div className="diag-stats-content">
      <div className="diag-stats-cards">
        <StatCard value={total} label="Stations" color="blue" />
        {total > 0 && (
          <>
            <StatCard value={formatDistance(avgDistance)} label="Avg Distance" color="green" />
            {furthest && furthest.distance != null && (
              <StatCard
                value={furthest.callsign}
                label={`Furthest (${formatDistance(furthest.distance)})`}
                color="purple"
              />
            )}
          </>
        )}
      </div>

      <div className="diag-stats-actions">
        <ActionButton onClick={onRefresh} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </ActionButton>
        {lastUpdated && (
          <span className="diag-stats-updated">Updated {formatRelativeTime(lastUpdated)}</span>
        )}
        {error && <span className="diag-stats-error">{error}</span>}
      </div>
    </div>
  )
}

// Main Panel Component
interface DiagnosticsPanelProps {
  packets: AprsPacket[]
  stats: Stats | null
  connected: boolean
  kissConnected: boolean
  isOpen: boolean
  onToggle: () => void
  stations: Station[]
  totalStations: number
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  onRefresh: () => void
}

export const DiagnosticsPanel: FC<DiagnosticsPanelProps> = ({
  packets,
  stats,
  connected,
  kissConnected,
  isOpen,
  onToggle,
  stations,
  totalStations,
  loading,
  error,
  lastUpdated,
  onRefresh,
}) => {
  const dispatch = useAppDispatch()
  const activeTab = useAppSelector((state) => state.ui.activeTab)
  const panelHeight = useAppSelector((state) => state.ui.diagnosticsHeight)

  const [lastPacketTime, setLastPacketTime] = useState<Date | null>(null)
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

  const handleTabChange = useCallback(
    (tabId: TabId) => {
      dispatch(setActiveTab(tabId))
    },
    [dispatch]
  )

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const windowHeight = window.innerHeight
      const newHeight = windowHeight - e.clientY
      const constraints = TAB_HEIGHT_CONSTRAINTS[activeTab]
      const clampedHeight = Math.min(constraints.max, Math.max(constraints.min, newHeight))
      dispatch(setDiagnosticsHeight(clampedHeight))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, dispatch, activeTab])

  const getStatusIndicator = () => {
    if (!connected) return '🔴'
    if (!kissConnected) return '🟡'
    return '🟢'
  }

  const getStatusText = () => {
    if (!connected) return 'Disconnected'
    if (!kissConnected) return 'TNC Disconnected'
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
        <div className="diagnostics-resize-handle" onMouseDown={handleMouseDown} />
      )}

      {/* Combined header + tab bar */}
      <div className="diag-header-bar">
        <span className="diag-status-indicator">{getStatusIndicator()}</span>
        {isOpen ? (
          <>
            <div role="tablist" className="diag-tabs">
              {tabs.map((tab) => (
                <Tab
                  key={tab.id}
                  label={tab.label}
                  active={activeTab === tab.id}
                  onClick={() => handleTabChange(tab.id)}
                />
              ))}
            </div>
            <div className="diag-header-right">
              <span className="diag-station-count">
                {stations.length}/{totalStations}
              </span>
              <button type="button" onClick={onToggle} className="diag-collapse-btn">
                ▼
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="diag-collapsed-title">Diagnostics</span>
            <span className="diag-collapsed-status">{getStatusText()}</span>
            <span className="diag-station-count">
              {stations.length}/{totalStations}
            </span>
            <button type="button" onClick={onToggle} className="diag-collapse-btn">
              ▲
            </button>
          </>
        )}
      </div>

      {isOpen && (
        <>
          {/* Tab content */}
          <div role="tabpanel" className="diag-content">
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
                kissConnected={kissConnected}
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
