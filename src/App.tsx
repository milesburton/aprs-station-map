import type { FC } from 'react'
import { useCallback, useEffect, useMemo } from 'react'
import { FilterPanel, StationList, StationMap, StatusBar } from './components'
import { useFilters, useMapState, useStations } from './hooks'
import { getUniqueSymbols, updateUrlState } from './services'
import type { Coordinates } from './types'

export const App: FC = () => {
  const { stations, loading, error, lastUpdated, refresh } = useStations()
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
    </div>
  )
}
