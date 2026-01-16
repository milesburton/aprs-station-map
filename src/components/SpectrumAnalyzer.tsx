import type { FC } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { setSpectrumPoppedOut } from '../store/slices/uiSlice'
import { WindowPortal } from './WindowPortal'

interface SpectrumData {
  frequencies: number[]
  magnitudes: number[]
  centerFreq: number
  sampleRate: number
  timestamp: number
}

interface CanvasSize {
  width: number
  height: number
}

// Store waterfall history globally so it persists across tab switches
// This provides a smoother UX when navigating between diagnostic tabs
const waterfallHistory: {
  data: Uint8ClampedArray | null
  width: number
  height: number
} = {
  data: null,
  width: 0,
  height: 0,
}

const magnitudeToColor = (normalized: number): { r: number; g: number; b: number } => {
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

const drawGrid = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: SpectrumData
) => {
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 1

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
}

const drawSpectrumLine = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  magnitudes: number[]
) => {
  ctx.strokeStyle = '#0f0'
  ctx.lineWidth = 2
  ctx.beginPath()

  for (let i = 0; i < magnitudes.length; i++) {
    const x = (i / magnitudes.length) * width
    const magnitude = magnitudes[i] ?? -100
    const y = height - ((magnitude + 100) / 100) * height

    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }

  ctx.stroke()
}

const drawCenterMarker = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  centerFreq: number
) => {
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
  ctx.fillText(`Centre: ${(centerFreq / 1e6).toFixed(3)} MHz`, width / 2 + 5, 15)
}

const scrollWaterfallDown = (imageData: ImageData, width: number, height: number) => {
  for (let y = height - 1; y > 0; y--) {
    for (let x = 0; x < width; x++) {
      const srcIdx = ((y - 1) * width + x) * 4
      const dstIdx = (y * width + x) * 4
      imageData.data[dstIdx] = imageData.data[srcIdx] ?? 0
      imageData.data[dstIdx + 1] = imageData.data[srcIdx + 1] ?? 0
      imageData.data[dstIdx + 2] = imageData.data[srcIdx + 2] ?? 0
    }
  }
}

const addWaterfallLine = (imageData: ImageData, width: number, magnitudes: number[]) => {
  for (let x = 0; x < width; x++) {
    const idx = Math.floor((x / width) * magnitudes.length)
    const magnitude = magnitudes[idx] ?? -100
    const normalized = Math.max(0, Math.min(1, (magnitude + 100) / 60))
    const color = magnitudeToColor(normalized)

    const pixelIdx = x * 4
    imageData.data[pixelIdx] = color.r
    imageData.data[pixelIdx + 1] = color.g
    imageData.data[pixelIdx + 2] = color.b
    imageData.data[pixelIdx + 3] = 255
  }
}

// Inner content component that can be rendered in main window or popout
interface SpectrumContentProps {
  isPoppedOut: boolean
  onPopout?: () => void
  onPopIn?: () => void
}

const SpectrumContent: FC<SpectrumContentProps> = ({ isPoppedOut, onPopout, onPopIn }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const waterfallCanvasRef = useRef<HTMLCanvasElement>(null)
  const [connected, setConnected] = useState(false)
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 800, height: 200 })
  const waterfallDataRef = useRef<ImageData | null>(null)

  // Track previous size to detect significant changes
  const prevSizeRef = useRef<CanvasSize>({ width: 800, height: 200 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleResize = (entries: ResizeObserverEntry[]) => {
      const entry = entries[0]
      if (!entry) return

      const containerWidth = Math.floor(entry.contentRect.width)
      const containerHeight = Math.floor(entry.contentRect.height)
      if (containerWidth <= 0 || containerHeight <= 0) return

      const panelWidth = Math.floor((containerWidth - 24) / 2)
      const panelHeight = Math.max(300, containerHeight - 80)
      const newSize = { width: panelWidth, height: panelHeight }
      const prev = prevSizeRef.current

      const significantChange =
        Math.abs(prev.width - newSize.width) > 10 || Math.abs(prev.height - newSize.height) > 10
      const isInitialSize = prev.width === 800 && prev.height === 200

      if (significantChange || isInitialSize) {
        prevSizeRef.current = newSize
        setCanvasSize(newSize)
        if (significantChange) {
          waterfallDataRef.current = null
          waterfallHistory.data = null
        }
      }
    }

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])

  const drawSpectrum = useCallback((data: SpectrumData) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)

    drawGrid(ctx, width, height, data)

    if (data.magnitudes.length === 0) return

    drawSpectrumLine(ctx, width, height, data.magnitudes)
    drawCenterMarker(ctx, width, height, data.centerFreq)
  }, [])

  const updateWaterfall = useCallback((data: SpectrumData) => {
    const canvas = waterfallCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    if (!waterfallDataRef.current) {
      waterfallDataRef.current = ctx.createImageData(width, height)

      // Try to restore from global history if dimensions match
      if (
        waterfallHistory.data &&
        waterfallHistory.width === width &&
        waterfallHistory.height === height
      ) {
        waterfallDataRef.current.data.set(waterfallHistory.data)
      } else {
        // Initialize with black background
        for (let i = 0; i < waterfallDataRef.current.data.length; i += 4) {
          waterfallDataRef.current.data[i] = 0
          waterfallDataRef.current.data[i + 1] = 0
          waterfallDataRef.current.data[i + 2] = 0
          waterfallDataRef.current.data[i + 3] = 255
        }
      }
    }

    const imageData = waterfallDataRef.current

    scrollWaterfallDown(imageData, width, height)
    addWaterfallLine(imageData, width, data.magnitudes)

    ctx.putImageData(imageData, 0, 0)

    // Save to global history for persistence across tab switches
    waterfallHistory.data = new Uint8ClampedArray(imageData.data)
    waterfallHistory.width = width
    waterfallHistory.height = height
  }, [])

  // Restore waterfall display on mount (when switching back to spectrum tab)
  useEffect(() => {
    const canvas = waterfallCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvasSize

    // Restore from global history if available and dimensions match
    if (
      waterfallHistory.data &&
      waterfallHistory.width === width &&
      waterfallHistory.height === height
    ) {
      const imageData = ctx.createImageData(width, height)
      imageData.data.set(waterfallHistory.data)
      ctx.putImageData(imageData, 0, 0)
      waterfallDataRef.current = imageData
    }
  }, [canvasSize])

  useEffect(() => {
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
  }, [drawSpectrum, updateWaterfall])

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-semibold text-slate-100">Spectrum Analyzer</h4>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-md text-sm font-semibold ${connected ? 'bg-green-500 text-slate-900' : 'bg-red-500 text-slate-900'}`}
          >
            {connected ? 'Live' : 'Disconnected'}
          </span>
          {isPoppedOut ? (
            <button
              type="button"
              onClick={onPopIn}
              className="px-3 py-1 rounded-md text-sm font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
              title="Return to main window"
            >
              Pop In
            </button>
          ) : (
            <button
              type="button"
              onClick={onPopout}
              className="px-3 py-1 rounded-md text-sm font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
              title="Open in new window"
            >
              Pop Out
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        <div className="flex-1 flex flex-col">
          <h5 className="text-sm font-medium text-slate-400 mb-2">Spectrum Scope</h5>
          <div className="flex-1 bg-black rounded-lg border border-slate-700 overflow-hidden">
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              className="w-full h-full"
            />
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <h5 className="text-sm font-medium text-slate-400 mb-2">Waterfall</h5>
          <div className="flex-1 bg-black rounded-lg border border-slate-700 overflow-hidden">
            <canvas
              ref={waterfallCanvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              className="w-full h-full"
            />
          </div>
        </div>
      </div>

      {!connected && (
        <div className="mt-4 p-4 bg-slate-800 rounded-lg text-center text-slate-400">
          <p>Connecting to spectrum analyzer...</p>
        </div>
      )}
    </div>
  )
}

// Main exported component that handles the popout state
export const SpectrumAnalyzer: FC = () => {
  const dispatch = useAppDispatch()
  const isPoppedOut = useAppSelector((state) => state.ui.spectrumPoppedOut)

  const handlePopout = useCallback(() => {
    dispatch(setSpectrumPoppedOut(true))
  }, [dispatch])

  const handlePopIn = useCallback(() => {
    dispatch(setSpectrumPoppedOut(false))
  }, [dispatch])

  // When popped out, show a placeholder in the main panel
  if (isPoppedOut) {
    return (
      <>
        <div className="flex flex-col h-full items-center justify-center text-slate-400">
          <p className="text-lg mb-4">Spectrum Analyzer is open in a separate window</p>
          <button
            type="button"
            onClick={handlePopIn}
            className="px-4 py-2 rounded-md text-sm font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
          >
            Return to Main Window
          </button>
        </div>
        <WindowPortal
          title="APRS Spectrum Analyzer"
          width={1200}
          height={600}
          onClose={handlePopIn}
        >
          <SpectrumContent isPoppedOut onPopIn={handlePopIn} />
        </WindowPortal>
      </>
    )
  }

  return <SpectrumContent isPoppedOut={false} onPopout={handlePopout} />
}
