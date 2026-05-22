import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { DiagnosticsPanel, ServiceStatus, StationMap, Toolbar } from './components'
import { useFilters, useMapState, useStations } from './hooks'
import { updateUrlState } from './services'
import { useAppDispatch, useAppSelector } from './store/hooks'
import { toggleDiagnostics } from './store/slices/ui-slice'
import type { Coordinates } from './types'
import { setupVersionCheck } from './utils/version'

export const App: FC = () => {
  const dispatch = useAppDispatch()
  const diagnosticsOpen = useAppSelector((state) => state.ui.diagnosticsOpen)

  const {
    stations,
    stats,
    health,
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
  } = useFilters(stations, kissConnected)
  const { mapState, setCentre, setZoom, selectStation, followStation, flyTo } = useMapState()

  // Symbols rarely change once a station is established. Recompute the sorted
  // unique-symbol list only when the *set* of symbols changes, not whenever
  // useStations hands us a fresh array reference. Keeps the Toolbar from
  // re-rendering on every WS flush.
  const cachedSymbolsRef = useRef<{ sig: string; list: string[] }>({ sig: '', list: [] })
  const availableSymbols = useMemo(() => {
    const set = new Set<string>()
    for (const s of stations) set.add(s.symbol)
    const sig = [...set].sort().join('|')
    if (sig !== cachedSymbolsRef.current.sig) {
      cachedSymbolsRef.current = { sig, list: [...set].sort() }
    }
    return cachedSymbolsRef.current.list
  }, [stations])

  const handleToggleDiagnostics = useCallback(() => {
    dispatch(toggleDiagnostics())
  }, [dispatch])

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

  useEffect(() => {
    if (!mapState.followedStation) return
    const station = stations.find((s) => s.callsign === mapState.followedStation)
    if (station?.coordinates) {
      flyTo(station.coordinates)
    }
  }, [mapState.followedStation, stations, flyTo])

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden">
      <ServiceStatus loading={loading} connected={connected} health={health} />
      <Toolbar
        filter={filter}
        availableSymbols={availableSymbols}
        kissConnected={kissConnected}
        health={health}
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
            onToggle={handleToggleDiagnostics}
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
