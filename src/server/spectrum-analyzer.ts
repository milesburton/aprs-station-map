import type { ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'

export interface SpectrumData {
  frequencies: number[]
  magnitudes: number[]
  centerFreq: number
  sampleRate: number
  timestamp: number
}

export class SpectrumAnalyzer extends EventEmitter {
  private process: ChildProcess | null = null
  private readonly fftSize = 512
  private readonly centerFreq: number
  private readonly sampleRate = 22050

  constructor(centerFreq: number) {
    super()
    this.centerFreq = centerFreq
  }

  start(): void {
    if (this.process) {
      console.warn('[Spectrum] Already running')
      return
    }

    console.log(`[Spectrum] Starting analyzer at ${this.centerFreq} Hz`)

    // Tap into rtl_fm output with a tee to analyze spectrum
    // This won't work directly since rtl_fm is already piped to direwolf
    // Instead, we'll need to modify the pipeline

    // For now, create a mock spectrum analyzer that generates test data
    this.startMockAnalyzer()
  }

  private startMockAnalyzer(): void {
    // Generate mock spectrum data for testing
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
    if (this.process) {
      this.process.kill()
      this.process = null
      console.log('[Spectrum] Stopped')
    }
  }
}
