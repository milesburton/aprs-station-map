import type { FC } from 'react'
import { useCallback, useEffect, useMemo } from 'react'
import { DiagnosticsPanel, StationMap, Toolbar } from './components'
import { useFilters, useMapState, useStations } from './hooks'
import { getUniqueSymbols, updateUrlState } from './services'
import { useAppDispatch, useAppSelector } from './store/hooks'
import { toggleDiagnostics } from './store/slices/uiSlice'
import type { Coordinates } from './types'
import { setupVersionCheck } from './utils/version'

export const App: FC = () => {
  const dispatch = useAppDispatch()
  const diagnosticsOpen = useAppSelector((state) => state.ui.diagnosticsOpen)

  const {
    stations,
    stats,
    loading,
    error,
    connected,
    kissConnected,
    lastUpdated,
    packets,
    stationHistory,
    refresh,
  } = useStations()

  const {
    filter,
    filteredStations,
    setSearch,
    setMaxDistance,
    setSymbolFilter,
    setSort,
    setTrailMaxAge,
    setStationMaxAge,
    setRfOnly,
    setDirectOnly,
    resetFilters,
  } = useFilters(stations)
  const { mapState, setCentre, setZoom, selectStation, followStation, flyTo } = useMapState()

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

  const handleFollowStation = useCallback(
    (callsign: string | null) => {
      followStation(callsign)
      if (callsign) {
        const station = stations.find((s) => s.callsign === callsign)
        if (station?.coordinates) flyTo(station.coordinates, 12)
      }
    },
    [followStation, stations, flyTo]
  )

  // Auto-fly to followed station when its position updates
  useEffect(() => {
    if (!mapState.followedStation) return
    const station = stations.find((s) => s.callsign === mapState.followedStation)
    if (station?.coordinates) {
      flyTo(station.coordinates)
    }
  }, [mapState.followedStation, stations, flyTo])

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden">
      <Toolbar
        filter={filter}
        availableSymbols={availableSymbols}
        onSearchChange={setSearch}
        onDistanceChange={setMaxDistance}
        onSymbolChange={setSymbolFilter}
        onSortChange={setSort}
        onTrailAgeChange={setTrailMaxAge}
        onStationAgeChange={setStationMaxAge}
        onRfOnlyChange={setRfOnly}
        onDirectOnlyChange={setDirectOnly}
        onReset={resetFilters}
      />

      <div className="flex flex-1 min-h-0">
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className={`flex-1 min-h-0 ${diagnosticsOpen ? '' : ''}`}>
            <StationMap
              stations={filteredStations}
              selectedStation={mapState.selectedStation}
              followedStation={mapState.followedStation}
              centre={mapState.centre}
              zoom={mapState.zoom}
              onSelectStation={handleStationSelect}
              onFollowStation={handleFollowStation}
              onMapMove={handleMapMove}
              stationHistory={stationHistory}
              trailMaxAgeHours={filter.trailMaxAgeHours}
            />
          </div>

          <DiagnosticsPanel
            packets={packets}
            stats={stats}
            connected={connected}
            kissConnected={kissConnected}
            isOpen={diagnosticsOpen}
            onToggle={() => dispatch(toggleDiagnostics())}
            stations={filteredStations}
            totalStations={stations.length}
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
