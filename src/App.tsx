import type { FC } from 'react'
import { useCallback, useEffect, useMemo } from 'react'
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
  useDefaultLayout,
} from 'react-resizable-panels'
import { DiagnosticsPanel, FilterPanel, StationList, StationMap } from './components'
import { useFilters, useLocalStorage, useMapState, useStations } from './hooks'
import { getUniqueSymbols, updateUrlState } from './services'
import type { Coordinates } from './types'
import { setupVersionCheck } from './utils/version'

export const App: FC = () => {
  const { stations, stats, loading, error, connected, lastUpdated, packets, refresh } =
    useStations()
  const [diagnosticsOpen, setDiagnosticsOpen] = useLocalStorage('aprs-diagnostics-open', false)

  const { defaultLayout: horizontalDefault, onLayoutChange: onHorizontalChange } = useDefaultLayout(
    {
      id: 'aprs-horizontal-layout',
      storage: localStorage,
    }
  )

  const { defaultLayout: verticalDefault, onLayoutChange: onVerticalChange } = useDefaultLayout({
    id: 'aprs-vertical-layout',
    storage: localStorage,
  })

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

  return (
    <div className="app">
      <header className="app-header">
        <h1>APRS Station Map</h1>
        <p>Real-time APRS stations</p>
      </header>

      <PanelGroup
        orientation="vertical"
        className="app-body"
        defaultLayout={verticalDefault}
        onLayoutChange={onVerticalChange}
      >
        <Panel id="main" minSize={10} className="main-panel">
          <main className="app-main">
            <PanelGroup
              orientation="horizontal"
              defaultLayout={horizontalDefault}
              onLayoutChange={onHorizontalChange}
            >
              <Panel
                id="sidebar"
                defaultSize={25}
                minSize={15}
                maxSize={50}
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

              <Panel id="map" minSize={40} className="map-panel">
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
        </Panel>

        {diagnosticsOpen && (
          <>
            <PanelResizeHandle className="resize-handle-horizontal" />
            <Panel
              id="diagnostics"
              defaultSize={40}
              minSize={10}
              className="diagnostics-panel-container"
            >
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
            </Panel>
          </>
        )}
      </PanelGroup>

      {!diagnosticsOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
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
        </div>
      )}
    </div>
  )
}
