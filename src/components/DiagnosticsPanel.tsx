import type { FC } from 'react'
import { useEffect, useRef } from 'react'
import type { AprsPacket } from '../types'
import { formatRelativeTime } from '../utils'

interface DiagnosticsPanelProps {
  packets: AprsPacket[]
  isOpen: boolean
  onToggle: () => void
}

export const DiagnosticsPanel: FC<DiagnosticsPanelProps> = ({ packets, isOpen, onToggle }) => {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [packets, isOpen])

  return (
    <div className={`diagnostics-panel ${isOpen ? 'open' : 'closed'}`}>
      <div className="diagnostics-header">
        <h3>APRS Packet Diagnostics</h3>
        <div className="diagnostics-controls">
          <span className="packet-count">{packets.length} packets</span>
          <button type="button" onClick={onToggle} className="toggle-button">
            {isOpen ? '▼ Hide' : '▲ Show'}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="diagnostics-content" ref={scrollRef}>
          {packets.length === 0 ? (
            <div className="diagnostics-empty">
              <p>Waiting for APRS packets...</p>
              <p className="diagnostics-hint">
                Packets will appear here as they are received from the KISS TNC
              </p>
            </div>
          ) : (
            <div className="packet-list">
              {packets.map((packet, index) => (
                <div key={`${packet.timestamp}-${index}`} className="packet-item">
                  <div className="packet-header">
                    <span className="packet-time">
                      {formatRelativeTime(new Date(packet.timestamp))}
                    </span>
                    <span className="packet-route">
                      <strong>{packet.source}</strong> → {packet.destination}
                      {packet.path && <span className="packet-path"> via {packet.path}</span>}
                    </span>
                  </div>
                  <div className="packet-raw">{packet.raw}</div>
                  {packet.comment && <div className="packet-comment">{packet.comment}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
