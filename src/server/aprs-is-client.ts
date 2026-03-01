import { EventEmitter } from 'node:events'
import { Socket } from 'node:net'
import { config } from './config'

const KEEPALIVE_INTERVAL_MS = 60_000 // APRS-IS servers drop idle connections after ~10 min
const KEEPALIVE_COMMENT = '#keepalive\r\n'

export class AprsIsClient extends EventEmitter {
  private socket: Socket | null = null
  private lineBuffer = ''
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null
  private shouldReconnect = true
  private readonly host: string
  private readonly port: number
  private readonly callsign: string
  private readonly passcode: string
  private readonly filter: string
  private readonly appVersion: string
  private readonly reconnectIntervalMs: number
  private readonly socketFactory: () => Socket

  constructor(options?: {
    host?: string
    port?: number
    callsign?: string
    passcode?: string
    filter?: string
    appVersion?: string
    reconnectIntervalMs?: number
    socketFactory?: () => Socket
  }) {
    super()
    this.host = options?.host ?? config.aprsIs.server
    this.port = options?.port ?? config.aprsIs.port
    this.callsign = options?.callsign ?? config.station.callsign
    this.passcode = options?.passcode ?? config.aprsIs.passcode
    this.filter = options?.filter ?? config.aprsIs.filter
    this.appVersion = options?.appVersion ?? 'aprs-station-map'
    this.reconnectIntervalMs = options?.reconnectIntervalMs ?? config.aprsIs.reconnectIntervalMs
    this.socketFactory = options?.socketFactory ?? (() => new Socket())
  }

  connect(): void {
    this.shouldReconnect = true
    this.doConnect()
  }

  private doConnect(): void {
    try {
      this.socket = this.socketFactory()

      this.socket.on('connect', () => {
        console.log(`[APRS-IS] Connected to ${this.host}:${this.port}`)
        this.sendLogin()
      })

      this.socket.on('data', (data: Buffer) => {
        this.handleData(data.toString('utf8'))
      })

      this.socket.on('close', () => {
        console.log('[APRS-IS] Connection closed')
        this.socket = null
        this.stopKeepalive()
        this.emit('disconnected')
        this.scheduleReconnect()
      })

      this.socket.on('error', (error: Error) => {
        console.error('[APRS-IS] Socket error:', error.message)
        this.emit('error', error)
      })

      this.socket.connect(this.port, this.host)
    } catch (error) {
      console.error(`[APRS-IS] Failed to connect to ${this.host}:${this.port}:`, error)
      this.emit('error', error instanceof Error ? error : new Error(String(error)))
      this.scheduleReconnect()
    }
  }

  private sendLogin(): void {
    const filterPart = this.filter ? ` filter ${this.filter}` : ''
    const loginLine = `USER ${this.callsign} pass ${this.passcode} vers ${this.appVersion}${filterPart}\r\n`
    this.socket?.write(loginLine)
    console.log(
      `[APRS-IS] Sent login for ${this.callsign}${filterPart ? ` with filter: ${this.filter}` : ''}`
    )
    this.startKeepalive()
  }

  private handleData(data: string): void {
    this.lineBuffer += data
    const lines = this.lineBuffer.split('\n')
    // Keep the last incomplete line in the buffer
    this.lineBuffer = lines.pop() ?? ''

    for (const rawLine of lines) {
      const line = rawLine.replace(/\r$/, '') // strip CR
      if (line.length === 0) continue

      if (line.startsWith('#')) {
        // Server comment or login response — check for auth confirmation
        console.log(`[APRS-IS] Server: ${line}`)
        if (line.includes('verified') || line.includes('logresp')) {
          this.emit('connected')
        }
        continue
      }

      this.emit('packet', line)
    }
  }

  private startKeepalive(): void {
    this.stopKeepalive()
    this.keepaliveTimer = setInterval(() => {
      if (this.socket && !this.socket.destroyed) {
        this.socket.write(KEEPALIVE_COMMENT)
      }
    }, KEEPALIVE_INTERVAL_MS)
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer)
      this.keepaliveTimer = null
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return
    if (this.reconnectTimer) return

    console.log(`[APRS-IS] Reconnecting in ${this.reconnectIntervalMs}ms...`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.doConnect()
    }, this.reconnectIntervalMs)
  }

  disconnect(): void {
    this.shouldReconnect = false
    this.stopKeepalive()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.socket) {
      this.socket.end()
      this.socket = null
    }
  }

  get isConnected(): boolean {
    return this.socket !== null && !this.socket.destroyed
  }
}

let aprsIsClient: AprsIsClient | null = null

export const getAprsIsClient = (): AprsIsClient => {
  if (!aprsIsClient) {
    aprsIsClient = new AprsIsClient()
  }
  return aprsIsClient
}

export const closeAprsIsClient = (): void => {
  if (aprsIsClient) {
    aprsIsClient.disconnect()
    aprsIsClient = null
  }
}
