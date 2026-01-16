import type { ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import * as fs from 'node:fs'

export interface SpectrumData {
  frequencies: number[]
  magnitudes: number[]
  centerFreq: number
  sampleRate: number
  timestamp: number
}

// Simple FFT implementation for real-valued signals
function fft(real: number[]): { real: number[]; imag: number[] } {
  const n = real.length
  if (n <= 1) return { real, imag: new Array(n).fill(0) }

  // Pad to power of 2 if needed
  const m = 2 ** Math.ceil(Math.log2(n))
  const paddedReal = [...real, ...new Array(m - n).fill(0)]
  const imag: number[] = new Array(m).fill(0)

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < m; i++) {
    let bit = m >> 1
    while (j & bit) {
      j ^= bit
      bit >>= 1
    }
    j ^= bit
    if (i < j) {
      // biome-ignore lint/style/noNonNullAssertion: FFT array indices are guaranteed valid
      ;[paddedReal[i], paddedReal[j]] = [paddedReal[j]!, paddedReal[i]!]
      // biome-ignore lint/style/noNonNullAssertion: FFT array indices are guaranteed valid
      ;[imag[i], imag[j]] = [imag[j]!, imag[i]!]
    }
  }

  // Cooley-Tukey FFT
  for (let len = 2; len <= m; len *= 2) {
    const halfLen = len / 2
    const angle = (-2 * Math.PI) / len
    for (let i = 0; i < m; i += len) {
      for (let j = 0; j < halfLen; j++) {
        const theta = angle * j
        const cos = Math.cos(theta)
        const sin = Math.sin(theta)
        const idx1 = i + j
        const idx2 = i + j + halfLen
        // biome-ignore lint/style/noNonNullAssertion: FFT indices within bounds
        const tReal = cos * paddedReal[idx2]! - sin * imag[idx2]!
        // biome-ignore lint/style/noNonNullAssertion: FFT indices within bounds
        const tImag = sin * paddedReal[idx2]! + cos * imag[idx2]!
        // biome-ignore lint/style/noNonNullAssertion: FFT indices within bounds
        paddedReal[idx2] = paddedReal[idx1]! - tReal
        // biome-ignore lint/style/noNonNullAssertion: FFT indices within bounds
        imag[idx2] = imag[idx1]! - tImag
        // biome-ignore lint/style/noNonNullAssertion: FFT indices within bounds
        paddedReal[idx1] = paddedReal[idx1]! + tReal
        // biome-ignore lint/style/noNonNullAssertion: FFT indices within bounds
        imag[idx1] = imag[idx1]! + tImag
      }
    }
  }

  return { real: paddedReal, imag }
}

export class SpectrumAnalyzer extends EventEmitter {
  private process: ChildProcess | null = null
  private readonly fftSize = 512
  private readonly centerFreq: number
  private readonly sampleRate = 22050
  private audioBuffer: number[] = []
  private pipePath = '/tmp/aprs-audio-pipe'
  private pipeStream: fs.ReadStream | null = null
  private updateInterval: ReturnType<typeof setInterval> | null = null
  private useMockData = false

  constructor(centerFreq: number) {
    super()
    this.centerFreq = centerFreq
  }

  start(): void {
    if (this.process || this.pipeStream) {
      console.warn('[Spectrum] Already running')
      return
    }

    console.log(`[Spectrum] Starting analyzer at ${this.centerFreq} Hz`)

    // Try to open the named pipe for reading
    this.tryOpenPipe()
  }

  private tryOpenPipe(): void {
    // Check if the named pipe exists
    if (fs.existsSync(this.pipePath)) {
      console.log(`[Spectrum] Found audio pipe at ${this.pipePath}, opening for reading`)
      try {
        // Open the pipe in non-blocking mode
        this.pipeStream = fs.createReadStream(this.pipePath, {
          highWaterMark: this.fftSize * 2, // 16-bit samples
        })

        this.pipeStream.on('data', (chunk: Buffer) => {
          this.processAudioData(chunk)
        })

        this.pipeStream.on('error', (err) => {
          console.error('[Spectrum] Pipe read error:', err.message)
          this.fallbackToMock()
        })

        this.pipeStream.on('close', () => {
          console.log('[Spectrum] Pipe closed, falling back to mock')
          this.fallbackToMock()
        })

        // Start update interval for emitting spectrum data
        this.startUpdateInterval()
      } catch (err) {
        console.error('[Spectrum] Failed to open pipe:', err)
        this.fallbackToMock()
      }
    } else {
      console.log(`[Spectrum] Audio pipe not found at ${this.pipePath}, using mock data`)
      this.fallbackToMock()
    }
  }

  private fallbackToMock(): void {
    if (this.useMockData) return
    this.useMockData = true

    if (this.pipeStream) {
      this.pipeStream.destroy()
      this.pipeStream = null
    }

    console.log('[Spectrum] Starting mock spectrum analyzer')
    this.startMockAnalyzer()
  }

  private processAudioData(chunk: Buffer): void {
    // Convert 16-bit signed PCM to float samples
    for (let i = 0; i < chunk.length - 1; i += 2) {
      const sample = chunk.readInt16LE(i) / 32768.0
      this.audioBuffer.push(sample)
    }

    // Keep buffer at reasonable size
    const maxBufferSize = this.fftSize * 4
    if (this.audioBuffer.length > maxBufferSize) {
      this.audioBuffer = this.audioBuffer.slice(-maxBufferSize)
    }
  }

  private startUpdateInterval(): void {
    this.updateInterval = setInterval(() => {
      if (this.audioBuffer.length >= this.fftSize) {
        this.computeAndEmitSpectrum()
      }
    }, 100) // Update 10 times per second
  }

  private computeAndEmitSpectrum(): void {
    // Take the most recent samples
    const samples = this.audioBuffer.slice(-this.fftSize)

    // Apply Hann window
    const windowed = samples.map((s, i) => {
      const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (this.fftSize - 1)))
      return s * window
    })

    // Perform FFT
    const { real, imag } = fft(windowed)

    // Compute magnitude spectrum (only positive frequencies)
    const numBins = this.fftSize / 2
    const frequencies: number[] = []
    const magnitudes: number[] = []

    for (let i = 0; i < numBins; i++) {
      const freq = this.centerFreq - this.sampleRate / 2 + (i * this.sampleRate) / this.fftSize
      frequencies.push(freq)

      // Compute magnitude in dB
      // biome-ignore lint/style/noNonNullAssertion: loop index within FFT output bounds
      const mag = Math.sqrt(real[i]! * real[i]! + imag[i]! * imag[i]!)
      const magDb = 20 * Math.log10(Math.max(mag / numBins, 1e-10))
      magnitudes.push(magDb)
    }

    const data: SpectrumData = {
      frequencies,
      magnitudes,
      centerFreq: this.centerFreq,
      sampleRate: this.sampleRate,
      timestamp: Date.now(),
    }

    this.emit('data', data)
  }

  private startMockAnalyzer(): void {
    // Generate mock spectrum data for testing/demo
    const interval = setInterval(() => {
      const numBins = this.fftSize / 2
      const frequencies: number[] = []
      const magnitudes: number[] = []

      for (let i = 0; i < numBins; i++) {
        const freq = this.centerFreq - this.sampleRate / 2 + (i * this.sampleRate) / this.fftSize
        frequencies.push(freq)

        // Generate noise floor with some peaks
        let magnitude = -80 + Math.random() * 10 // Noise floor around -80dB

        // Add some signal peaks for visualization
        if (Math.abs(freq - this.centerFreq) < 1000) {
          magnitude += 20 + Math.random() * 10 // Peak at center frequency
        }
        if (Math.abs(freq - (this.centerFreq + 5000)) < 500) {
          magnitude += 15 + Math.random() * 5 // Side peak
        }

        magnitudes.push(magnitude)
      }

      const data: SpectrumData = {
        frequencies,
        magnitudes,
        centerFreq: this.centerFreq,
        sampleRate: this.sampleRate,
        timestamp: Date.now(),
      }

      this.emit('data', data)
    }, 100) // Update 10 times per second

    // Store interval reference for cleanup
    this.process = { kill: () => clearInterval(interval) } as unknown as ChildProcess
  }

  stop(): void {
    if (this.pipeStream) {
      this.pipeStream.destroy()
      this.pipeStream = null
    }
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
    if (this.process) {
      this.process.kill()
      this.process = null
    }
    console.log('[Spectrum] Stopped')
  }
}
