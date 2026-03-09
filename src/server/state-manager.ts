import { EventEmitter } from 'node:events'
import type { DbStation, DbVessel } from './database'

export interface StationUpdateEvent {
  type: 'station_update'
  station: DbStation
  isNew: boolean
}

export interface VesselUpdateEvent {
  type: 'vessel_update'
  vessel: DbVessel
  isNew: boolean
}

export interface StatsUpdateEvent {
  type: 'stats_update'
  stats: {
    totalStations: number
    stationsWithPosition: number
    totalPackets: number
  }
}

export interface ConnectionEvent {
  type: 'kiss_connected' | 'kiss_disconnected' | 'ais_connected' | 'ais_disconnected'
}

export interface AprsPacketEvent {
  type: 'aprs_packet'
  packet: {
    raw: string
    source: string
    destination: string
    path?: string
    comment?: string
    timestamp: string
  }
}

export type StateEvent =
  | StationUpdateEvent
  | VesselUpdateEvent
  | StatsUpdateEvent
  | ConnectionEvent
  | AprsPacketEvent

class StateManager extends EventEmitter {
  private kissConnected = false
  private aisConnected = false
  private lastAprsPacketAt: number | null = null

  emitStationUpdate(station: DbStation, isNew: boolean): void {
    const event: StationUpdateEvent = {
      type: 'station_update',
      station,
      isNew,
    }
    this.emit('state', event)
  }

  emitVesselUpdate(vessel: DbVessel, isNew: boolean): void {
    const event: VesselUpdateEvent = {
      type: 'vessel_update',
      vessel,
      isNew,
    }
    this.emit('state', event)
  }

  emitStatsUpdate(stats: StatsUpdateEvent['stats']): void {
    const event: StatsUpdateEvent = {
      type: 'stats_update',
      stats,
    }
    this.emit('state', event)
  }

  emitKissConnected(): void {
    this.kissConnected = true
    const event: ConnectionEvent = { type: 'kiss_connected' }
    this.emit('state', event)
  }

  emitKissDisconnected(): void {
    this.kissConnected = false
    const event: ConnectionEvent = { type: 'kiss_disconnected' }
    this.emit('state', event)
  }

  emitAisConnected(): void {
    this.aisConnected = true
    const event: ConnectionEvent = { type: 'ais_connected' }
    this.emit('state', event)
  }

  emitAisDisconnected(): void {
    this.aisConnected = false
    const event: ConnectionEvent = { type: 'ais_disconnected' }
    this.emit('state', event)
  }

  isKissConnected(): boolean {
    return this.kissConnected
  }

  isAisConnected(): boolean {
    return this.aisConnected
  }

  emitAprsPacket(packet: AprsPacketEvent['packet']): void {
    this.lastAprsPacketAt = Date.now()
    const event: AprsPacketEvent = {
      type: 'aprs_packet',
      packet,
    }
    this.emit('state', event)
  }

  getLastAprsPacketAt(): number | null {
    return this.lastAprsPacketAt
  }
}

export const stateManager = new StateManager()
