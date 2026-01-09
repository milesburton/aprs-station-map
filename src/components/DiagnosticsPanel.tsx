import type { FC } from 'react'
import { useEffect, useRef, useState } from 'react'
import { getStationStats } from '../services'
import type { AprsPacket, Station, Stats } from '../types'
import { formatDistance, formatRelativeTime } from '../utils'
import { CLIENT_VERSION } from '../utils/version'
import { SpectrumAnalyzer } from './SpectrumAnalyzer'

declare const __BUILD_TIME__: string

const KissTncHelp: FC = () => (
  <div className="bg-slate-800 border-l-[3px] border-red-500 rounded-md p-4 mb-4 text-xs">
    <h4 className="mb-2 text-slate-100 text-sm">🔧 KISS TNC Not Connected</h4>
    <p className="mb-2 text-slate-400 leading-relaxed">
      The application cannot connect to the KISS TNC. Possible issues:
    </p>
    <ul className="my-2 pl-6 text-slate-400 list-disc">
      <li className="mb-1">Direwolf TNC service is not running inside the container</li>
      <li className="mb-1">Container was started before Direwolf was ready</li>
      <li className="mb-1">Audio device configuration issue preventing Direwolf startup</li>
    </ul>
    <p className="mb-2 text-slate-400 leading-relaxed">
      Check container logs:{' '}
      <code className="bg-slate-900 p-1 rounded font-mono text-blue-500">
        docker compose logs -f
      </code>
    </p>
  </div>
)

const AwaitingPacketsInfo: FC = () => (
  <div className="bg-slate-800 border-l-[3px] border-blue-500 rounded-md p-4 mb-4 text-xs">
    <h4 className="mb-2 text-slate-100 text-sm">📡 Listening for APRS Packets</h4>
    <p className="mb-2 text-slate-400 leading-relaxed">
      System is ready and waiting for RF signals on 144.800 MHz.
    </p>
    <p className="mb-2 text-slate-400 leading-relaxed">
      If no packets appear after several minutes, verify:
    </p>
    <ul className="my-2 pl-6 text-slate-400 list-disc">
      <li className="mb-1">Audio source is configured (RTL-SDR, sound card, or external input)</li>
      <li className="mb-1">Antenna is connected</li>
      <li className="mb-1">There is APRS activity in your area</li>
    </ul>
  </div>
)

const PacketItem: FC<{ packet: AprsPacket; index: number }> = ({ packet, index }) => (
  <div
    key={`${packet.timestamp}-${index}`}
    className="p-3 bg-slate-800 border border-slate-700 rounded-lg font-mono text-sm"
  >
    <div className="flex justify-between items-center mb-2 gap-4">
      <span className="text-slate-400 whitespace-nowrap">
        {formatRelativeTime(new Date(packet.timestamp))}
      </span>
      <span className="text-slate-100 flex-1">
        <strong className="text-green-500">{packet.source}</strong> → {packet.destination}
        {packet.path && <span className="text-slate-400 text-xs"> via {packet.path}</span>}
      </span>
    </div>
    <div className="p-2 bg-slate-900 rounded-md overflow-x-auto whitespace-pre-wrap break-all text-blue-500 border-l-[3px] border-blue-500">
      {packet.raw}
    </div>
    {packet.comment && <div className="mt-2 p-2 text-slate-400 italic">{packet.comment}</div>}
  </div>
)

interface StatusTabProps {
  connected: boolean
  stats: Stats | null
  lastPacketTime: Date | null
  getStatusText: () => string
}

const StatusTab: FC<StatusTabProps> = ({ connected, stats, lastPacketTime, getStatusText }) => {
  const showKissHelp = stats !== null && !stats.kissConnected
  const showAwaitingInfo = stats?.kissConnected && stats.totalPackets === 0

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-900">
      <div className="bg-slate-800 rounded-lg p-6 mb-6">
        <h4 className="text-lg font-semibold text-slate-100 mb-4">Service Status</h4>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-3 px-4 bg-slate-900 rounded-lg">
            <span className="text-slate-400 font-semibold">WebSocket Connection:</span>
            <span
              className={`px-3 py-1 rounded-md text-sm font-semibold ${connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
            >
              {connected ? '✅ Connected' : '❌ Disconnected'}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 px-4 bg-slate-900 rounded-lg">
            <span className="text-slate-400 font-semibold">KISS TNC:</span>
            <span
              className={`px-3 py-1 rounded-md text-sm font-semibold ${stats?.kissConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
            >
              {stats?.kissConnected ? '✅ Connected' : '❌ Disconnected'}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 px-4 bg-slate-900 rounded-lg">
            <span className="text-slate-400 font-semibold">Overall Status:</span>
            <span className="text-slate-100">{getStatusText()}</span>
          </div>
          {lastPacketTime && (
            <div className="flex justify-between items-center py-3 px-4 bg-slate-900 rounded-lg">
              <span className="text-slate-400 font-semibold">Last Packet Received:</span>
              <span className="text-slate-100">{formatRelativeTime(lastPacketTime)}</span>
            </div>
          )}
        </div>
      </div>

      {stats && (
        <div className="bg-slate-800 rounded-lg p-6 mb-6">
          <h4 className="text-lg font-semibold text-slate-100 mb-4">Statistics</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-400">{stats.totalStations}</div>
              <div className="text-sm text-slate-400 mt-1">Total Stations</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-400">{stats.stationsWithPosition}</div>
              <div className="text-sm text-slate-400 mt-1">With Position</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-purple-400">{stats.totalPackets}</div>
              <div className="text-sm text-slate-400 mt-1">Total Packets</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-orange-400">144.800</div>
              <div className="text-sm text-slate-400 mt-1">Frequency (MHz)</div>
            </div>
          </div>
        </div>
      )}

      {showKissHelp && <KissTncHelp />}
      {showAwaitingInfo && <AwaitingPacketsInfo />}
    </div>
  )
}

const AboutTab: FC = () => {
  const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? new Date(__BUILD_TIME__) : null

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-900 flex flex-col gap-6">
      <div className="bg-slate-800 rounded-lg p-6">
        <h4 className="text-xl font-semibold text-slate-100 mb-4">APRS Station Map</h4>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between items-center py-2 border-b border-slate-700">
            <span className="text-slate-400">Version:</span>
            <span className="text-slate-100 font-mono">{CLIENT_VERSION}</span>
          </div>
          {buildTime && (
            <div className="flex justify-between items-center py-2 border-b border-slate-700">
              <span className="text-slate-400">Build Time:</span>
              <span className="text-slate-100 font-mono">{buildTime.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between items-center py-2 border-b border-slate-700">
            <span className="text-slate-400">Frequency:</span>
            <span className="text-slate-100 font-mono">144.800 MHz</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-slate-400">Protocol:</span>
            <span className="text-slate-100 font-mono">APRS (AX.25)</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-slate-100 mb-4">Components</h4>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between items-center py-2 border-b border-slate-700">
            <span className="text-slate-400">TNC:</span>
            <span className="text-slate-100">Direwolf</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-slate-700">
            <span className="text-slate-400">Frontend:</span>
            <span className="text-slate-100">React + Leaflet</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-slate-400">Backend:</span>
            <span className="text-slate-100">Node.js + WebSocket</span>
          </div>
        </div>
      </div>
    </div>
  )
}

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
    <div className="flex-1 overflow-y-auto p-6 bg-slate-900 flex flex-col gap-6">
      <div className="flex gap-6 flex-wrap">
        <div className="bg-slate-800 rounded-lg p-5 flex flex-col min-w-[140px]">
          <span className="text-3xl font-semibold text-slate-100">{total}</span>
          <span className="text-sm text-slate-400 mt-1">Stations</span>
        </div>
        {total > 0 && (
          <>
            <div className="bg-slate-800 rounded-lg p-5 flex flex-col min-w-[140px]">
              <span className="text-3xl font-semibold text-slate-100">
                {formatDistance(avgDistance)}
              </span>
              <span className="text-sm text-slate-400 mt-1">Avg Distance</span>
            </div>
            {furthest && furthest.distance != null && (
              <div className="bg-slate-800 rounded-lg p-5 flex flex-col min-w-[140px]">
                <span className="text-3xl font-semibold text-slate-100">{furthest.callsign}</span>
                <span className="text-sm text-slate-400 mt-1">
                  Furthest ({formatDistance(furthest.distance)})
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-6 pt-4 border-t border-slate-700">
        {error && <span className="text-red-500">{error}</span>}
        {lastUpdated && (
          <span className="text-slate-400 text-sm">Updated {formatRelativeTime(lastUpdated)}</span>
        )}
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 border-none rounded-md text-white text-sm cursor-pointer transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
    </div>
  )
}

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
  const scrollRef = useRef<HTMLDivElement>(null)
  const [lastPacketTime, setLastPacketTime] = useState<Date | null>(null)
  const [activeTab, setActiveTab] = useState<'stats' | 'packets' | 'spectrum' | 'status' | 'about'>(
    'stats'
  )

  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [isOpen])

  useEffect(() => {
    if (packets.length > 0) {
      const lastPacket = packets[packets.length - 1]
      if (lastPacket) {
        setLastPacketTime(new Date(lastPacket.timestamp))
      }
    }
  }, [packets])

  const getStatusIndicator = () => {
    if (!connected) return '🔴'
    if (stats !== null && !stats.kissConnected) return '🟡'
    return '🟢'
  }

  const getStatusText = () => {
    if (!connected) return 'WebSocket Disconnected'
    if (stats !== null && !stats.kissConnected) return 'KISS TNC Disconnected'
    if (stats === null) return 'Connecting...'
    if (packets.length === 0) return 'Ready - Awaiting Packets'
    return `Receiving Packets (${packets.length} total)`
  }

  return (
    <div
      className="flex flex-col bg-slate-800 border-t-2 border-blue-600 overflow-hidden"
      style={{ height: isOpen ? '100%' : '40px' }}
    >
      <button
        type="button"
        className="flex justify-between items-center px-4 bg-slate-900 border-none border-b border-slate-700 cursor-pointer shrink-0"
        style={{ height: '40px', minHeight: '40px' }}
        onClick={onToggle}
      >
        <h3 className="text-sm font-semibold text-slate-100">
          {getStatusIndicator()} APRS Packet Diagnostics
        </h3>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400">{packets.length} packets</span>
          <span className="px-2 py-1 bg-blue-600 border-none rounded text-white text-xs cursor-pointer transition-colors hover:bg-blue-700">
            {isOpen ? '▼ Hide' : '▲ Show'}
          </span>
        </div>
      </button>

      {isOpen && (
        <>
          <div className="flex gap-2 px-6 py-3 bg-slate-800 border-b border-slate-700">
            <button
              type="button"
              className={`px-5 py-2 bg-transparent border-none border-b-2 cursor-pointer text-sm transition-all rounded-t ${activeTab === 'stats' ? 'text-blue-500 border-blue-500 bg-slate-900' : 'text-slate-400 border-transparent hover:text-slate-100 hover:bg-slate-900'}`}
              onClick={() => setActiveTab('stats')}
            >
              📈 Stats
            </button>
            <button
              type="button"
              className={`px-5 py-2 bg-transparent border-none border-b-2 cursor-pointer text-sm transition-all rounded-t ${activeTab === 'packets' ? 'text-blue-500 border-blue-500 bg-slate-900' : 'text-slate-400 border-transparent hover:text-slate-100 hover:bg-slate-900'}`}
              onClick={() => setActiveTab('packets')}
            >
              📦 Packets
            </button>
            <button
              type="button"
              className={`px-5 py-2 bg-transparent border-none border-b-2 cursor-pointer text-sm transition-all rounded-t ${activeTab === 'spectrum' ? 'text-blue-500 border-blue-500 bg-slate-900' : 'text-slate-400 border-transparent hover:text-slate-100 hover:bg-slate-900'}`}
              onClick={() => setActiveTab('spectrum')}
            >
              📊 Spectrum
            </button>
            <button
              type="button"
              className={`px-5 py-2 bg-transparent border-none border-b-2 cursor-pointer text-sm transition-all rounded-t ${activeTab === 'status' ? 'text-blue-500 border-blue-500 bg-slate-900' : 'text-slate-400 border-transparent hover:text-slate-100 hover:bg-slate-900'}`}
              onClick={() => setActiveTab('status')}
            >
              🔧 Status
            </button>
            <button
              type="button"
              className={`px-5 py-2 bg-transparent border-none border-b-2 cursor-pointer text-sm transition-all rounded-t ${activeTab === 'about' ? 'text-blue-500 border-blue-500 bg-slate-900' : 'text-slate-400 border-transparent hover:text-slate-100 hover:bg-slate-900'}`}
              onClick={() => setActiveTab('about')}
            >
              ℹ️ About
            </button>
          </div>

          {activeTab === 'stats' && (
            <StatsTab
              stations={stations}
              loading={loading}
              error={error}
              lastUpdated={lastUpdated}
              onRefresh={onRefresh}
            />
          )}

          {activeTab === 'packets' && (
            <div className="flex-1 overflow-y-auto p-6 bg-slate-900" ref={scrollRef}>
              {packets.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                  <p className="text-lg mb-2">No packets received yet</p>
                  <p className="text-sm">Packets will appear here as they are decoded</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {packets.map((packet, index) => (
                    <PacketItem
                      key={`${packet.timestamp}-${index}`}
                      packet={packet}
                      index={index}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'spectrum' && (
            <div className="flex-1 overflow-y-auto p-6 bg-slate-900">
              <SpectrumAnalyzer />
            </div>
          )}

          {activeTab === 'status' && (
            <StatusTab
              connected={connected}
              stats={stats}
              lastPacketTime={lastPacketTime}
              getStatusText={getStatusText}
            />
          )}

          {activeTab === 'about' && <AboutTab />}
        </>
      )}
    </div>
  )
}
