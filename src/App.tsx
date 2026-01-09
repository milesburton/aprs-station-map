import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { DiagnosticsPanel, FilterPanel, StationList, StationMap, StatusBar } from './components'
import { useFilters, useMapState, useStations } from './hooks'
import { getUniqueSymbols, updateUrlState } from './services'
import type { Coordinates } from './types'
import { setupVersionCheck } from './utils/version'

export const App: FC = () => {
  console.log('[App] Rendering')
  const { stations, stats, loading, error, connected, lastUpdated, packets, refresh } =
    useStations()
  console.log('[App] useStations returned, stations:', stations.length, 'connected:', connected)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
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

  // Setup version checking
  useEffect(() => {
    console.log('[App] Version check effect mounting')
    const cleanup = setupVersionCheck(60000) // Check every minute
    return () => {
      console.log('[App] Version check effect cleanup')
      cleanup()
    }
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

      <StatusBar
        stations={filteredStations}
        loading={loading}
        error={error}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
      />

      <main className="app-main">
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
