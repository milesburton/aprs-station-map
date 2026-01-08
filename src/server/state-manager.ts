import { EventEmitter } from 'node:events'
import type { DbStation } from './database'

export interface StationUpdateEvent {
  type: 'station_update'
  station: DbStation
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
  type: 'kiss_connected' | 'kiss_disconnected'
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

export type StateEvent = StationUpdateEvent | StatsUpdateEvent | ConnectionEvent | AprsPacketEvent

class StateManager extends EventEmitter {
  private kissConnected = false

  emitStationUpdate(station: DbStation, isNew: boolean): void {
    const event: StationUpdateEvent = {
      type: 'station_update',
      station,
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

  isKissConnected(): boolean {
    return this.kissConnected
  }

  emitAprsPacket(packet: AprsPacketEvent['packet']): void {
    const event: AprsPacketEvent = {
      type: 'aprs_packet',
      packet,
    }
    this.emit('state', event)
  }
}

export const stateManager = new StateManager()
