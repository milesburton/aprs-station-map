import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { DiagnosticsPanel, FilterPanel, StationList, StationMap } from './components'
import { useFilters, useLocalStorage, useMapState, useStations } from './hooks'
import { getUniqueSymbols, updateUrlState } from './services'
import type { Coordinates } from './types'
import { setupVersionCheck } from './utils/version'

const SIDEBAR_WIDTH_KEY = 'aprs-sidebar-width'
const DEFAULT_SIDEBAR_WIDTH = 288
const MIN_SIDEBAR_WIDTH = 200
const MAX_SIDEBAR_WIDTH = 500

export const App: FC = () => {
  const {
    stations,
    stats,
    loading,
    error,
    connected,
    lastUpdated,
    packets,
    stationHistory,
    refresh,
  } = useStations()
  const [diagnosticsOpen, setDiagnosticsOpen] = useLocalStorage('aprs-diagnostics-open', false)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY)
    return saved ? Number.parseInt(saved, 10) : DEFAULT_SIDEBAR_WIDTH
  })
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)

  const {
    filter,
    filteredStations,
    setSearch,
    setMaxDistance,
    setSymbolFilter,
    setSort,
    setTrailMaxAge,
    resetFilters,
  } = useFilters(stations)
  const { mapState, setCentre, setZoom, selectStation, flyTo } = useMapState()

  const availableSymbols = useMemo(() => getUniqueSymbols(stations), [stations])

  useEffect(() => {
    updateUrlState(filter, mapState)
  }, [filter, mapState])

  useEffect(() => {
    const cleanup = setupVersionCheck(60000)
    return () => cleanup()
  }, [])

  const handleMapMove = useCallback(
    (centre: Coordinates, zoom: number) => {
      setCentre(centre)
      setZoom(zoom)
    },
    [setCentre, setZoom]
  )

  const handleStationSelect = useCallback(
    (callsign: string | null) => {
      selectStation(callsign)
      const station = callsign ? stations.find((s) => s.callsign === callsign) : null
      if (station?.coordinates) flyTo(station.coordinates, 12)
    },
    [selectStation, stations, flyTo]
  )

  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingSidebar(true)
  }, [])

  useEffect(() => {
    if (!isResizingSidebar) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX
      const clampedWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, newWidth))
      setSidebarWidth(clampedWidth)
    }

    const handleMouseUp = () => {
      setIsResizingSidebar(false)
      localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString())
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingSidebar, sidebarWidth])

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden">
      <header className="px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
        <h1 className="text-lg font-semibold text-white">APRS Station Map</h1>
        <p className="text-xs text-slate-400">Real-time APRS stations via KISS TNC</p>
      </header>

      <div className={`flex flex-1 min-h-0 ${isResizingSidebar ? 'select-none' : ''}`}>
        <aside
          data-testid="sidebar"
          style={{ width: sidebarWidth }}
          className="shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col overflow-hidden"
        >
          <FilterPanel
            filter={filter}
            availableSymbols={availableSymbols}
            onSearchChange={setSearch}
            onDistanceChange={setMaxDistance}
            onSymbolChange={setSymbolFilter}
            onSortChange={setSort}
            onTrailAgeChange={setTrailMaxAge}
            onReset={resetFilters}
          />
          <StationList
            stations={filteredStations}
            selectedStation={mapState.selectedStation}
            onSelectStation={handleStationSelect}
          />
        </aside>
        {/* Sidebar resize handle */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: resize handle is mouse-only */}
        <div
          data-testid="sidebar-resize-handle"
          className="w-1 shrink-0 bg-slate-700 hover:bg-blue-500 cursor-ew-resize transition-colors"
          onMouseDown={handleSidebarMouseDown}
        />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className={`flex-1 min-h-0 ${diagnosticsOpen ? '' : ''}`}>
            <StationMap
              stations={filteredStations}
              selectedStation={mapState.selectedStation}
              centre={mapState.centre}
              zoom={mapState.zoom}
              onSelectStation={handleStationSelect}
              onMapMove={handleMapMove}
              stationHistory={stationHistory}
              trailMaxAgeHours={filter.trailMaxAgeHours}
            />
          </div>

          <DiagnosticsPanel
            packets={packets}
            stats={stats}
            connected={connected}
            isOpen={diagnosticsOpen}
            onToggle={() => setDiagnosticsOpen(!diagnosticsOpen)}
            stations={filteredStations}
            loading={loading}
            error={error}
            lastUpdated={lastUpdated}
            onRefresh={refresh}
          />
        </main>
      </div>
    </div>
  )
}
