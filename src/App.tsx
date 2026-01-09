import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
  type PanelSize,
} from 'react-resizable-panels'
import { DiagnosticsPanel, FilterPanel, StationList, StationMap, StatusBar } from './components'
import { useFilters, useLocalStorage, useMapState, useStations } from './hooks'
import { getUniqueSymbols, updateUrlState } from './services'
import type { Coordinates } from './types'
import { setupVersionCheck } from './utils/version'

interface UiState {
  sidebarSize: number
  diagnosticsOpen: boolean
}

const DEFAULT_UI_STATE: UiState = {
  sidebarSize: 25,
  diagnosticsOpen: false,
}

export const App: FC = () => {
  const { stations, stats, loading, error, connected, lastUpdated, packets, refresh } =
    useStations()
  const [uiState, setUiState] = useLocalStorage<UiState>('aprs-ui-state', DEFAULT_UI_STATE)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(uiState.diagnosticsOpen)
  const {
    filter,
    filteredStations,
    setSearch,
    setMaxDistance,
    setSymbolFilter,
    setSort,
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

  useEffect(() => {
    setUiState({ ...uiState, diagnosticsOpen })
  }, [diagnosticsOpen, setUiState, uiState])

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

  const handleSidebarResize = useCallback(
    (panelSize: PanelSize) => {
      setUiState({ ...uiState, sidebarSize: panelSize.asPercentage })
    },
    [setUiState, uiState]
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1>APRS Station Map</h1>
        <p>Real-time APRS stations</p>
      </header>

      <StatusBar
        stations={filteredStations}
        loading={loading}
        error={error}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
      />

      <main className="app-main">
        <PanelGroup orientation="horizontal">
          <Panel
            defaultSize={uiState.sidebarSize}
            minSize={15}
            maxSize={50}
            onResize={handleSidebarResize}
            className="sidebar-panel"
          >
            <aside className="sidebar">
              <FilterPanel
                filter={filter}
                availableSymbols={availableSymbols}
                onSearchChange={setSearch}
                onDistanceChange={setMaxDistance}
                onSymbolChange={setSymbolFilter}
                onSortChange={setSort}
                onReset={resetFilters}
              />
              <StationList
                stations={filteredStations}
                selectedStation={mapState.selectedStation}
                onSelectStation={handleStationSelect}
              />
            </aside>
          </Panel>

          <PanelResizeHandle className="resize-handle" />

          <Panel minSize={40} className="map-panel">
            <section className="map-container">
              <StationMap
                stations={filteredStations}
                selectedStation={mapState.selectedStation}
                centre={mapState.centre}
                zoom={mapState.zoom}
                onSelectStation={handleStationSelect}
                onMapMove={handleMapMove}
              />
            </section>
          </Panel>
        </PanelGroup>
      </main>

      <DiagnosticsPanel
        packets={packets}
        stats={stats}
        connected={connected}
        isOpen={diagnosticsOpen}
        onToggle={() => setDiagnosticsOpen(!diagnosticsOpen)}
      />
    </div>
  )
}
