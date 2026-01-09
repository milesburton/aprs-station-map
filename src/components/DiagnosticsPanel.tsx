import type { FC } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { AprsPacket, Stats } from '../types'
import { formatRelativeTime } from '../utils'
import { SpectrumAnalyzer } from './SpectrumAnalyzer'

const KissTncHelp: FC = () => (
  <div className="diagnostics-help">
    <h4>🔧 KISS TNC Not Connected</h4>
    <p>The application cannot connect to the KISS TNC. Possible issues:</p>
    <ul>
      <li>Direwolf TNC service is not running inside the container</li>
      <li>Container was started before Direwolf was ready</li>
      <li>Audio device configuration issue preventing Direwolf startup</li>
    </ul>
    <p>
      Check container logs: <code>docker compose logs -f</code>
    </p>
  </div>
)

const AwaitingPacketsInfo: FC = () => (
  <div className="diagnostics-info">
    <h4>📡 Listening for APRS Packets</h4>
    <p>System is ready and waiting for RF signals on 144.800 MHz.</p>
    <p>If no packets appear after several minutes, verify:</p>
    <ul>
      <li>Audio source is configured (RTL-SDR, sound card, or external input)</li>
      <li>Antenna is connected</li>
      <li>There is APRS activity in your area</li>
    </ul>
  </div>
)

const PacketItem: FC<{ packet: AprsPacket; index: number }> = ({ packet, index }) => (
  <div key={`${packet.timestamp}-${index}`} className="packet-item">
    <div className="packet-header">
      <span className="packet-time">{formatRelativeTime(new Date(packet.timestamp))}</span>
      <span className="packet-route">
        <strong>{packet.source}</strong> → {packet.destination}
        {packet.path && <span className="packet-path"> via {packet.path}</span>}
      </span>
    </div>
    <div className="packet-raw">{packet.raw}</div>
    {packet.comment && <div className="packet-comment">{packet.comment}</div>}
  </div>
)

interface StatusDisplayProps {
  connected: boolean
  stats: Stats | null
  lastPacketTime: Date | null
  getStatusText: () => string
}

const StatusDisplay: FC<StatusDisplayProps> = ({
  connected,
  stats,
  lastPacketTime,
  getStatusText,
}) => (
  <div className="diagnostics-status">
    <div className="status-row">
      <span className="status-label">WebSocket:</span>
      <span className={`status-value ${connected ? 'connected' : 'disconnected'}`}>
        {connected ? '✅ Connected' : '❌ Disconnected'}
      </span>
    </div>
    <div className="status-row">
      <span className="status-label">KISS TNC:</span>
      <span className={`status-value ${stats?.kissConnected ? 'connected' : 'disconnected'}`}>
        {stats?.kissConnected ? '✅ Connected' : '❌ Disconnected'}
      </span>
    </div>
    <div className="status-row">
      <span className="status-label">Status:</span>
      <span className="status-value">{getStatusText()}</span>
    </div>
    {lastPacketTime && (
      <div className="status-row">
        <span className="status-label">Last Packet:</span>
        <span className="status-value">{formatRelativeTime(lastPacketTime)}</span>
      </div>
    )}
    {stats && (
      <>
        <div className="status-row">
          <span className="status-label">Total Stations:</span>
          <span className="status-value">{stats.totalStations}</span>
        </div>
        <div className="status-row">
          <span className="status-label">Total Packets:</span>
          <span className="status-value">{stats.totalPackets}</span>
        </div>
      </>
    )}
  </div>
)

interface DiagnosticsPanelProps {
  packets: AprsPacket[]
  stats: Stats | null
  connected: boolean
  isOpen: boolean
  onToggle: () => void
}

export const DiagnosticsPanel: FC<DiagnosticsPanelProps> = ({
  packets,
  stats,
  connected,
  isOpen,
  onToggle,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [lastPacketTime, setLastPacketTime] = useState<Date | null>(null)
  const [activeTab, setActiveTab] = useState<'packets' | 'spectrum'>('packets')

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

  const showKissHelp = stats !== null && !stats.kissConnected
  const showAwaitingInfo = stats?.kissConnected && packets.length === 0

  return (
    <div className={`diagnostics-panel ${isOpen ? 'open' : 'closed'}`}>
      <button type="button" className="diagnostics-header" onClick={onToggle}>
        <h3>{getStatusIndicator()} APRS Packet Diagnostics</h3>
        <div className="diagnostics-controls">
          <span className="packet-count">{packets.length} packets</span>
          <span className="toggle-button">{isOpen ? '▼ Hide' : '▲ Show'}</span>
        </div>
      </button>

      {isOpen && (
        <>
          <div className="diagnostics-tabs">
            <button
              type="button"
              className={`tab ${activeTab === 'packets' ? 'active' : ''}`}
              onClick={() => setActiveTab('packets')}
            >
              📦 Packets
            </button>
            <button
              type="button"
              className={`tab ${activeTab === 'spectrum' ? 'active' : ''}`}
              onClick={() => setActiveTab('spectrum')}
            >
              📊 Spectrum
            </button>
          </div>

          {activeTab === 'packets' && (
            <div className="diagnostics-content" ref={scrollRef}>
              <StatusDisplay
                connected={connected}
                stats={stats}
                lastPacketTime={lastPacketTime}
                getStatusText={getStatusText}
              />

              {showKissHelp && <KissTncHelp />}
              {showAwaitingInfo && <AwaitingPacketsInfo />}

              {packets.length > 0 && (
                <div className="packet-list">
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
            <div className="diagnostics-content">
              <SpectrumAnalyzer />
            </div>
          )}
        </>
      )}
    </div>
  )
}
