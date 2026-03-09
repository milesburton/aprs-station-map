import { EventEmitter } from 'node:events'
import { Socket } from 'node:net'
import type { ParsedAisMessage } from './ais-parser'
import { parseAisLine } from './ais-parser'
import type { AisSource } from './config'

export interface AisClientConfig {
  source: AisSource
  kissHost?: string
  kissPort?: number
  kissReconnectIntervalMs?: number
  httpApiUrl?: string
  httpUpdateIntervalMs?: number
}

export class AisClient extends EventEmitter {
  private source: AisSource
  private socket?: Socket
  private reconnectTimer?: NodeJS.Timeout
  private connectionTimeoutId?: NodeJS.Timeout
  private linked: Map<string, ParsedAisMessage> = new Map()
  private reconnectIntervalMs: number
  private connectionTimeoutMs: number
  private httpIntervalId?: NodeJS.Timeout
  private isConnected = false

  private kissHost: string
  private kissPort: number

  private httpApiUrl: string

  constructor(config: AisClientConfig) {
    super()
    this.source = config.source
    this.kissHost = config.kissHost ?? 'localhost'
    this.kissPort = config.kissPort ?? 8002
    this.reconnectIntervalMs = config.kissReconnectIntervalMs ?? 5000
    this.connectionTimeoutMs = 10000
    this.httpApiUrl = config.httpApiUrl ?? 'https://api.maritimetraffic.com'
  }

  public connect(): void {
    if (this.source === 'none') {
      console.log('[AIS] Disabled in configuration')
      return
    }

    if (this.source === 'kiss') {
      this.connectKiss()
    } else if (this.source === 'http') {
      this.connectHttp()
    }
  }

  private connectKiss(): void {
    if (this.isConnected) return

    console.log(`[AIS] Connecting to KISS device at ${this.kissHost}:${this.kissPort}`)

    this.socket = new Socket()
    let buffer = ''

    // Set connection timeout to prevent indefinite hangs
    this.connectionTimeoutId = setTimeout(() => {
      if (this.socket && !this.socket.destroyed) {
        console.error(`[AIS] KISS connection timeout after ${this.connectionTimeoutMs}ms`)
        this.socket.destroy()
      }
    }, this.connectionTimeoutMs)

    this.socket.on('data', (data) => {
      buffer += data.toString('utf-8')
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const aisMsg = parseAisLine(line)
        if (aisMsg) {
          this.linked.set(aisMsg.mmsi, aisMsg)
          this.emit('vessel', aisMsg)
        }
      }
    })

    this.socket.on('connect', () => {
      if (this.connectionTimeoutId) {
        clearTimeout(this.connectionTimeoutId)
        this.connectionTimeoutId = undefined
      }
      console.log('[AIS] Connected to KISS device')
      this.isConnected = true
      this.emit('connected')
    })

    this.socket.on('error', (error) => {
      if (this.connectionTimeoutId) {
        clearTimeout(this.connectionTimeoutId)
        this.connectionTimeoutId = undefined
      }
      console.error('[AIS] KISS connection error:', error)
      this.isConnected = false
      this.emit('error', error)
      this.scheduleReconnect()
    })

    this.socket.on('close', () => {
      if (this.connectionTimeoutId) {
        clearTimeout(this.connectionTimeoutId)
        this.connectionTimeoutId = undefined
      }
      console.log('[AIS] KISS connection closed')
      this.isConnected = false
      this.emit('disconnected')
      this.scheduleReconnect()
    })

    this.socket.connect(this.kissPort, this.kissHost)
  }

  private connectHttp(): void {
    console.log('[AIS] Starting HTTP AIS polling from', this.httpApiUrl)
    this.isConnected = true
    this.emit('connected')

    this.httpIntervalId = setInterval(() => {
      this.fetchHttpAis()
    }, 5000)

    this.fetchHttpAis()
  }

  private async fetchHttpAis(): Promise<void> {
    try {
      console.log('[AIS] HTTP polling (not yet implemented)')
    } catch (error) {
      console.error('[AIS] HTTP fetch error:', error)
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return

    console.log(`[AIS] Scheduling reconnect in ${this.reconnectIntervalMs}ms`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined
      if (this.source === 'kiss') {
        this.connectKiss()
      }
    }, this.reconnectIntervalMs)
  }

  public getVessels(): ParsedAisMessage[] {
    return Array.from(this.linked.values())
      .filter((v) => {
        const age = Date.now() - new Date(v.timestamp).getTime()
        return age < 10 * 60 * 1000
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  }

  public getVessel(mmsi: string): ParsedAisMessage | undefined {
    const vessel = this.linked.get(mmsi)
    if (!vessel) return undefined

    const age = Date.now() - new Date(vessel.timestamp).getTime()
    if (age > 10 * 60 * 1000) {
      this.linked.delete(mmsi)
      return undefined
    }

    return vessel
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.destroy()
      this.socket = undefined
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }

    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId)
      this.connectionTimeoutId = undefined
    }

    if (this.httpIntervalId) {
      clearInterval(this.httpIntervalId)
      this.httpIntervalId = undefined
    }

    this.isConnected = false
    this.linked.clear()
    console.log('[AIS] Disconnected')
  }

  public getConnected(): boolean {
    return this.isConnected
  }
}

// Singleton instance
let aisClient: AisClient | null = null

/**
 * Get or create AIS client instance
 */
export const getAisClient = (config: AisClientConfig): AisClient => {
  if (!aisClient) {
    aisClient = new AisClient(config)
  }
  return aisClient
}

/**
 * Close AIS client
 */
export const closeAisClient = (): void => {
  if (aisClient) {
    aisClient.disconnect()
    aisClient = null
  }
}
