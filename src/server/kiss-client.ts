import { EventEmitter } from 'node:events'
import { Socket } from 'node:net'
import { config } from './config'

// KISS frame constants
const KISS_FEND = 0xc0 // Frame End
const KISS_FESC = 0xdb // Frame Escape
const KISS_TFEND = 0xdc // Transposed Frame End
const KISS_TFESC = 0xdd // Transposed Frame Escape
const KISS_DATA_FRAME = 0x00 // Data frame command

export interface KissClientEvents {
  packet: (packet: Uint8Array) => void
  connected: () => void
  disconnected: () => void
  error: (error: Error) => void
}

export class KissClient extends EventEmitter {
  private socket: Socket | null = null
  private buffer: number[] = []
  private inFrame = false
  private escape = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private shouldReconnect = true
  private _host: string
  private _port: number

  constructor(host?: string, port?: number) {
    super()
    this._host = host ?? config.kiss.host
    this._port = port ?? config.kiss.port
  }

  async connect(): Promise<void> {
    this.shouldReconnect = true
    await this.doConnect()
  }

  private async doConnect(): Promise<void> {
    return new Promise((resolve) => {
      try {
        this.socket = new Socket()

        this.socket.on('connect', () => {
          console.log(`[KISS] Connected to ${this._host}:${this._port}`)
          this.emit('connected')
          resolve()
        })

        this.socket.on('data', (data: Buffer) => {
          this.handleData(new Uint8Array(data))
        })

        this.socket.on('close', () => {
          console.log('[KISS] Connection closed')
          this.socket = null
          this.emit('disconnected')
          this.scheduleReconnect()
        })

        this.socket.on('error', (error: Error) => {
          console.error('[KISS] Socket error:', error.message)
          this.emit('error', error)
        })

        this.socket.connect(this._port, this._host)
      } catch (error) {
        console.error(`[KISS] Failed to connect to ${this._host}:${this._port}:`, error)
        this.emit('error', error instanceof Error ? error : new Error(String(error)))
        this.scheduleReconnect()
        resolve()
      }
    })
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return
    if (this.reconnectTimer) return

    console.log(`[KISS] Reconnecting in ${config.kiss.reconnectIntervalMs}ms...`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.doConnect()
    }, config.kiss.reconnectIntervalMs)
  }

  disconnect(): void {
    this.shouldReconnect = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.socket) {
      this.socket.end()
      this.socket = null
    }
  }

  private handleData(data: Uint8Array): void {
    for (const byte of data) {
      this.processByte(byte)
    }
  }

  private processByte(byte: number): void {
    if (byte === KISS_FEND) {
      if (this.inFrame && this.buffer.length > 0) {
        this.processFrame(new Uint8Array(this.buffer))
      }
      this.buffer = []
      this.inFrame = true
      this.escape = false
      return
    }

    if (!this.inFrame) return

    if (this.escape) {
      this.escape = false
      if (byte === KISS_TFEND) {
        this.buffer.push(KISS_FEND)
      } else if (byte === KISS_TFESC) {
        this.buffer.push(KISS_FESC)
      } else {
        // Invalid escape sequence, push both bytes
        this.buffer.push(KISS_FESC, byte)
      }
      return
    }

    if (byte === KISS_FESC) {
      this.escape = true
      return
    }

    this.buffer.push(byte)
  }

  private processFrame(frame: Uint8Array): void {
    if (frame.length < 2) return

    const firstByte = frame[0]
    if (firstByte === undefined) return

    const command = firstByte & 0x0f

    if (command !== KISS_DATA_FRAME) {
      // Not a data frame, ignore
      return
    }

    // Extract AX.25 packet (skip KISS command byte)
    const ax25Packet = frame.slice(1)
    if (ax25Packet.length > 0) {
      this.emit('packet', ax25Packet)
    }
  }

  get isConnected(): boolean {
    return this.socket !== null && !this.socket.destroyed
  }
}

// Singleton instance
let kissClient: KissClient | null = null

export const getKissClient = (): KissClient => {
  if (!kissClient) {
    kissClient = new KissClient()
  }
  return kissClient
}

export const closeKissClient = (): void => {
  if (kissClient) {
    kissClient.disconnect()
    kissClient = null
  }
}
