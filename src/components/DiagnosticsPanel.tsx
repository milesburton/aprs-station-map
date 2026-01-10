import type { FC } from 'react'
import { useEffect, useRef, useState } from 'react'
import { getStationStats } from '../services'
import { card, colors, heading, innerCard, tabContent } from '../styles/tokens'
import type { AprsPacket, Station, Stats } from '../types'
import { formatDistance, formatRelativeTime } from '../utils'
import { CLIENT_VERSION } from '../utils/version'
import { SpectrumAnalyzer } from './SpectrumAnalyzer'

declare const __BUILD_TIME__: string

const KissTncHelp: FC = () => (
  <div className={`${card.base} border-l-[3px] border-red-500 p-5 text-xs`}>
    <h4 className="mb-3 text-slate-100 text-sm font-semibold">🔧 KISS TNC Not Connected</h4>
    <p className="mb-3 text-slate-400 leading-relaxed">
      The application cannot connect to the KISS TNC. Possible issues:
    </p>
    <ul className="my-3 pl-6 text-slate-400 list-disc space-y-2">
      <li>Direwolf TNC service is not running inside the container</li>
      <li>Container was started before Direwolf was ready</li>
      <li>Audio device configuration issue preventing Direwolf startup</li>
    </ul>
    <p className="mt-4 text-slate-400 leading-relaxed">
      Check container logs:{' '}
      <code className={`${colors.bg.primary} px-2 py-1 rounded font-mono ${colors.accent.blue}`}>
        docker compose logs -f
      </code>
    </p>
  </div>
)

const AwaitingPacketsInfo: FC = () => (
  <div className={`${card.base} border-l-[3px] border-blue-500 p-5 text-xs`}>
    <h4 className="mb-3 text-slate-100 text-sm font-semibold">📡 Listening for APRS Packets</h4>
    <p className="mb-3 text-slate-400 leading-relaxed">
      System is ready and waiting for RF signals on 144.800 MHz.
    </p>
    <p className="mb-3 text-slate-400 leading-relaxed">
      If no packets appear after several minutes, verify:
    </p>
    <ul className="my-3 pl-6 text-slate-400 list-disc space-y-2">
      <li>Audio source is configured (RTL-SDR, sound card, or external input)</li>
      <li>Antenna is connected</li>
      <li>There is APRS activity in your area</li>
    </ul>
  </div>
)

const PacketItem: FC<{ packet: AprsPacket; index: number }> = ({ packet, index }) => (
  <div
    key={`${packet.timestamp}-${index}`}
    className="bg-slate-800 border border-slate-600 rounded-xl p-5 font-mono text-sm shadow-md"
  >
    <div className="flex justify-between items-center mb-4 gap-6">
      <span className="text-slate-400 whitespace-nowrap text-xs bg-slate-900 px-3 py-1.5 rounded-md">
        {formatRelativeTime(new Date(packet.timestamp))}
      </span>
      <span className="text-slate-100 flex-1 text-right">
        <strong className="text-green-400 text-base">{packet.source}</strong>
        <span className="text-slate-500 mx-2">→</span>
        <span className="text-slate-200">{packet.destination}</span>
        {packet.path && <span className="text-slate-500 text-xs ml-3">via {packet.path}</span>}
      </span>
    </div>
    <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all text-blue-400 border-l-4 border-blue-500">
      {packet.raw}
    </div>
    {packet.comment && (
      <div className="mt-4 pt-4 border-t border-slate-700 text-slate-400 italic text-xs">
        {packet.comment}
      </div>
    )}
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
    <div className={tabContent.withGap}>
      <div className={card.full}>
        <h4 className={heading.section}>Service Status</h4>
        <div className="space-y-4">
          <div className={`flex justify-between items-center py-4 px-5 ${innerCard.base}`}>
            <span className={`${colors.text.secondary} font-semibold`}>WebSocket Connection:</span>
            <span
              className={`px-4 py-2 rounded-md text-sm font-semibold ${connected ? colors.status.success : colors.status.error}`}
            >
              {connected ? '✅ Connected' : '❌ Disconnected'}
            </span>
          </div>
          <div className={`flex justify-between items-center py-4 px-5 ${innerCard.base}`}>
            <span className={`${colors.text.secondary} font-semibold`}>KISS TNC:</span>
            <span
              className={`px-4 py-2 rounded-md text-sm font-semibold ${stats?.kissConnected ? colors.status.success : colors.status.error}`}
            >
              {stats?.kissConnected ? '✅ Connected' : '❌ Disconnected'}
            </span>
          </div>
          <div className={`flex justify-between items-center py-4 px-5 ${innerCard.base}`}>
            <span className={`${colors.text.secondary} font-semibold`}>Overall Status:</span>
            <span className={colors.text.primary}>{getStatusText()}</span>
          </div>
          {lastPacketTime && (
            <div className={`flex justify-between items-center py-4 px-5 ${innerCard.base}`}>
              <span className={`${colors.text.secondary} font-semibold`}>
                Last Packet Received:
              </span>
              <span className={colors.text.primary}>{formatRelativeTime(lastPacketTime)}</span>
            </div>
          )}
        </div>
      </div>

      {stats && (
        <div className={card.full}>
          <h4 className={heading.section}>Statistics</h4>
          <div className="grid grid-cols-2 gap-5">
            <div className={`${innerCard.base} p-5 text-center`}>
              <div className="text-3xl font-bold text-blue-400">{stats.totalStations}</div>
              <div className={`text-sm ${colors.text.secondary} mt-2`}>Total Stations</div>
            </div>
            <div className={`${innerCard.base} p-5 text-center`}>
              <div className="text-3xl font-bold text-green-400">{stats.stationsWithPosition}</div>
              <div className={`text-sm ${colors.text.secondary} mt-2`}>With Position</div>
            </div>
            <div className={`${innerCard.base} p-5 text-center`}>
              <div className="text-3xl font-bold text-purple-400">{stats.totalPackets}</div>
              <div className={`text-sm ${colors.text.secondary} mt-2`}>Total Packets</div>
            </div>
            <div className={`${innerCard.base} p-5 text-center`}>
              <div className="text-3xl font-bold text-orange-400">144.800</div>
              <div className={`text-sm ${colors.text.secondary} mt-2`}>Frequency (MHz)</div>
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
    <div className="flex-1 overflow-y-auto p-8 bg-slate-900 flex flex-col gap-8">
      <div className="bg-slate-800 rounded-xl p-8 border border-slate-600 shadow-lg">
        <h4 className="text-2xl font-bold text-white mb-6">APRS Station Map</h4>
        <div className="flex flex-col gap-1 text-base">
          <div className="flex justify-between items-center py-4 border-b border-slate-600">
            <span className="text-slate-400 font-medium">Version:</span>
            <span className="text-white font-mono text-lg">{CLIENT_VERSION}</span>
          </div>
          {buildTime && (
            <div className="flex justify-between items-center py-4 border-b border-slate-600">
              <span className="text-slate-400 font-medium">Build Time:</span>
              <span className="text-white font-mono">{buildTime.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between items-center py-4 border-b border-slate-600">
            <span className="text-slate-400 font-medium">Frequency:</span>
            <span className="text-white font-mono">144.800 MHz</span>
          </div>
          <div className="flex justify-between items-center py-4">
            <span className="text-slate-400 font-medium">Protocol:</span>
            <span className="text-white font-mono">APRS (AX.25)</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-8 border border-slate-600 shadow-lg">
        <h4 className="text-xl font-bold text-white mb-6">Components</h4>
        <div className="flex flex-col gap-1 text-base">
          <div className="flex justify-between items-center py-4 border-b border-slate-600">
            <span className="text-slate-400 font-medium">TNC:</span>
            <span className="text-white">Direwolf</span>
          </div>
          <div className="flex justify-between items-center py-4 border-b border-slate-600">
            <span className="text-slate-400 font-medium">Frontend:</span>
            <span className="text-white">React + Leaflet</span>
          </div>
          <div className="flex justify-between items-center py-4">
            <span className="text-slate-400 font-medium">Backend:</span>
            <span className="text-white">Node.js + WebSocket</span>
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
    <div className="flex-1 overflow-y-auto p-6 bg-slate-900">
      <div className="flex gap-4 flex-wrap mb-6">
        <div className="bg-slate-800 rounded-lg p-5 flex flex-col min-w-[160px]">
          <span className="text-3xl font-bold text-white">{total}</span>
          <span className="text-sm text-slate-400 mt-2">Stations</span>
        </div>
        {total > 0 && (
          <>
            <div className="bg-slate-800 rounded-lg p-5 flex flex-col min-w-[160px]">
              <span className="text-3xl font-bold text-white">{formatDistance(avgDistance)}</span>
              <span className="text-sm text-slate-400 mt-2">Avg Distance</span>
            </div>
            {furthest && furthest.distance != null && (
              <div className="bg-slate-800 rounded-lg p-5 flex flex-col min-w-[160px]">
                <span className="text-3xl font-bold text-green-400">{furthest.callsign}</span>
                <span className="text-sm text-slate-400 mt-2">
                  Furthest ({formatDistance(furthest.distance)})
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        {error && <span className="text-red-400 text-sm">{error}</span>}
        {lastUpdated && (
          <span className="text-slate-400 text-sm">Updated {formatRelativeTime(lastUpdated)}</span>
        )}
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 rounded-md text-white text-sm font-medium cursor-pointer transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="flex px-4 py-3 bg-slate-900 border-b border-slate-700">
            <div className="inline-flex bg-slate-800 rounded-lg p-1 gap-1">
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium transition-all rounded-md ${activeTab === 'stats' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                onClick={() => setActiveTab('stats')}
              >
                Stats
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium transition-all rounded-md ${activeTab === 'packets' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                onClick={() => setActiveTab('packets')}
              >
                Packets
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium transition-all rounded-md ${activeTab === 'spectrum' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                onClick={() => setActiveTab('spectrum')}
              >
                Spectrum
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium transition-all rounded-md ${activeTab === 'status' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                onClick={() => setActiveTab('status')}
              >
                Status
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium transition-all rounded-md ${activeTab === 'about' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                onClick={() => setActiveTab('about')}
              >
                About
              </button>
            </div>
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
            <div className={tabContent.base} ref={scrollRef}>
              {packets.length === 0 ? (
                <div className={`text-center ${colors.text.secondary} py-12`}>
                  <p className="text-lg mb-3">No packets received yet</p>
                  <p className="text-sm">Packets will appear here as they are decoded</p>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
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
            <div className={tabContent.base}>
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
