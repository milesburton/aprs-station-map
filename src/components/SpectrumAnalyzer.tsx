import type { FC } from 'react'
import { useEffect, useRef, useState } from 'react'

interface SpectrumData {
  frequencies: number[]
  magnitudes: number[]
  centerFreq: number
  sampleRate: number
  timestamp: number
}

export const SpectrumAnalyzer: FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const waterfallCanvasRef = useRef<HTMLCanvasElement>(null)
  const [connected, setConnected] = useState(false)
  const waterfallDataRef = useRef<ImageData | null>(null)

  useEffect(() => {
    // Connect to spectrum WebSocket (same pattern as main WebSocket)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/spectrum`

    console.log('[Spectrum] Connecting to:', wsUrl)
    const websocket = new WebSocket(wsUrl)

    websocket.onopen = () => {
      console.log('[Spectrum] WebSocket connected')
      setConnected(true)
    }

    websocket.onclose = () => {
      console.log('[Spectrum] WebSocket disconnected')
      setConnected(false)
    }

    websocket.onerror = (error) => {
      console.error('[Spectrum] WebSocket error:', error)
      setConnected(false)
    }

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'spectrum') {
          drawSpectrum(message.data)
          updateWaterfall(message.data)
        }
      } catch (error) {
        console.error('[Spectrum] Parse error:', error)
      }
    }

    return () => {
      websocket.close()
    }
  }, [])

  const drawSpectrum = (data: SpectrumData) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)

    // Draw grid
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1

    // Horizontal grid lines (dB levels)
    for (let db = -100; db <= 0; db += 10) {
      const y = height - ((db + 100) / 100) * height
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()

      ctx.fillStyle = '#666'
      ctx.font = '10px monospace'
      ctx.fillText(`${db}dB`, 5, y - 2)
    }

    // Vertical grid lines (frequency)
    const numFreqLines = 5
    for (let i = 0; i <= numFreqLines; i++) {
      const x = (i / numFreqLines) * width
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()

      const freq = data.centerFreq + (i / numFreqLines - 0.5) * data.sampleRate
      ctx.fillStyle = '#666'
      ctx.font = '10px monospace'
      ctx.fillText(`${(freq / 1e6).toFixed(3)}MHz`, x + 2, height - 5)
    }

    // Draw spectrum
    if (data.magnitudes.length === 0) return

    ctx.strokeStyle = '#0f0'
    ctx.lineWidth = 2
    ctx.beginPath()

    for (let i = 0; i < data.magnitudes.length; i++) {
      const x = (i / data.magnitudes.length) * width
      const magnitude = data.magnitudes[i] ?? -100
      const y = height - ((magnitude + 100) / 100) * height

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }

    ctx.stroke()

    // Draw center frequency marker
    ctx.strokeStyle = '#f00'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(width / 2, 0)
    ctx.lineTo(width / 2, height)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = '#f00'
    ctx.font = '12px monospace'
    ctx.fillText(`Center: ${(data.centerFreq / 1e6).toFixed(3)} MHz`, width / 2 + 5, 15)
  }

  const updateWaterfall = (data: SpectrumData) => {
    const canvas = waterfallCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Initialize waterfall buffer if needed
    if (!waterfallDataRef.current) {
      waterfallDataRef.current = ctx.createImageData(width, height)
      // Fill with black
      for (let i = 0; i < waterfallDataRef.current.data.length; i += 4) {
        waterfallDataRef.current.data[i] = 0 // R
        waterfallDataRef.current.data[i + 1] = 0 // G
        waterfallDataRef.current.data[i + 2] = 0 // B
        waterfallDataRef.current.data[i + 3] = 255 // A
      }
    }

    const imageData = waterfallDataRef.current

    // Scroll existing data down by one pixel
    for (let y = height - 1; y > 0; y--) {
      for (let x = 0; x < width; x++) {
        const srcIdx = ((y - 1) * width + x) * 4
        const dstIdx = (y * width + x) * 4
        imageData.data[dstIdx] = imageData.data[srcIdx] ?? 0
        imageData.data[dstIdx + 1] = imageData.data[srcIdx + 1] ?? 0
        imageData.data[dstIdx + 2] = imageData.data[srcIdx + 2] ?? 0
      }
    }

    // Add new line at top
    for (let x = 0; x < width; x++) {
      const idx = Math.floor((x / width) * data.magnitudes.length)
      const magnitude = data.magnitudes[idx] ?? -100

      // Convert magnitude to color (blue=weak, green=medium, yellow/red=strong)
      const normalized = Math.max(0, Math.min(1, (magnitude + 100) / 60))
      const color = magnitudeToColor(normalized)

      const pixelIdx = x * 4
      imageData.data[pixelIdx] = color.r
      imageData.data[pixelIdx + 1] = color.g
      imageData.data[pixelIdx + 2] = color.b
      imageData.data[pixelIdx + 3] = 255
    }

    ctx.putImageData(imageData, 0, 0)
  }

  const magnitudeToColor = (normalized: number): { r: number; g: number; b: number } => {
    // Color gradient: blue -> cyan -> green -> yellow -> red
    if (normalized < 0.25) {
      const t = normalized / 0.25
      return { r: 0, g: 0, b: Math.floor(255 * (1 - t)) + Math.floor(255 * t) }
    }
    if (normalized < 0.5) {
      const t = (normalized - 0.25) / 0.25
      return { r: 0, g: Math.floor(255 * t), b: 255 }
    }
    if (normalized < 0.75) {
      const t = (normalized - 0.5) / 0.25
      return { r: Math.floor(255 * t), g: 255, b: Math.floor(255 * (1 - t)) }
    }
    const t = (normalized - 0.75) / 0.25
    return { r: 255, g: Math.floor(255 * (1 - t)), b: 0 }
  }

  return (
    <div className="spectrum-analyzer">
      <div className="spectrum-header">
        <h4>📡 Spectrum Analyzer</h4>
        <span className={`spectrum-status ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? '⚡ Live' : '❌ Disconnected'}
        </span>
      </div>

      <div className="spectrum-display">
        <div className="spectrum-chart">
          <canvas ref={canvasRef} width={800} height={200} />
        </div>
        <div className="waterfall-display">
          <canvas ref={waterfallCanvasRef} width={800} height={300} />
        </div>
      </div>

      {!connected && (
        <div className="spectrum-info">
          <p>Connecting to spectrum analyzer...</p>
        </div>
      )}
    </div>
  )
}
