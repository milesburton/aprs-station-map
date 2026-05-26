import { BookOpen, Github, TriangleAlert } from 'lucide-react'
import type { FC } from 'react'
import { memo, useEffect, useRef, useState } from 'react'
import { APRS_SYMBOLS, DEFAULT_CONFIG } from '../constants'
import type { FilterState, HealthStatus, SortDirection, SortField } from '../types'

const REPO_URL = 'https://github.com/milesburton/aprs-station-map'
const DOCS_URL = 'https://github.com/milesburton/aprs-station-map#readme'

const SEARCH_DEBOUNCE_MS = 300
const DISTANCE_DEBOUNCE_MS = 150

interface ToolbarProps {
  filter: FilterState
  availableSymbols: string[]
  kissConnected: boolean
  health: HealthStatus | null
  onSearchChange: (search: string) => void
  onDistanceChange: (distance: number) => void
  onSymbolChange: (symbol: string | null) => void
  onSortChange: (field: SortField, direction: SortDirection) => void
  onTrailAgeChange: (hours: number) => void
  onStationAgeChange: (hours: number) => void
  onRfOnlyChange: (rfOnly: boolean) => void
  onDirectOnlyChange: (directOnly: boolean) => void
  onReset: () => void
}

const STATION_AGE_OPTIONS = [
  { value: 1, label: '1h' },
  { value: 24, label: '24h' },
  { value: 168, label: '7d' },
  { value: 720, label: '30d' },
  { value: 0, label: 'All' },
]

const TRAIL_AGE_OPTIONS = [
  { value: 0.083, label: '5m' },
  { value: 1, label: '1h' },
  { value: 6, label: '6h' },
  { value: 24, label: '24h' },
  { value: 0, label: 'All' },
]

const ToolbarInner: FC<ToolbarProps> = ({
  filter,
  availableSymbols,
  kissConnected,
  health,
  onSearchChange,
  onDistanceChange,
  onSymbolChange,
  onSortChange,
  onTrailAgeChange,
  onStationAgeChange,
  onRfOnlyChange,
  onDirectOnlyChange,
  onReset,
}) => {
  // Local-state mirrors for the search box and distance slider so typing /
  // dragging stays at native speed; the upstream Redux dispatch (which fans
  // out to filterStations across hundreds of stations) only fires after the
  // user pauses. We sync back from props so external resets still work.
  const [searchInput, setSearchInput] = useState(filter.search)
  const [distanceInput, setDistanceInput] = useState(filter.maxDistance)
  const lastDispatchedSearch = useRef(filter.search)
  const lastDispatchedDistance = useRef(filter.maxDistance)

  useEffect(() => {
    if (filter.search !== lastDispatchedSearch.current) {
      setSearchInput(filter.search)
      lastDispatchedSearch.current = filter.search
    }
  }, [filter.search])

  useEffect(() => {
    if (filter.maxDistance !== lastDispatchedDistance.current) {
      setDistanceInput(filter.maxDistance)
      lastDispatchedDistance.current = filter.maxDistance
    }
  }, [filter.maxDistance])

  useEffect(() => {
    if (searchInput === lastDispatchedSearch.current) return
    const id = window.setTimeout(() => {
      lastDispatchedSearch.current = searchInput
      onSearchChange(searchInput)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [searchInput, onSearchChange])

  useEffect(() => {
    if (distanceInput === lastDispatchedDistance.current) return
    const id = window.setTimeout(() => {
      lastDispatchedDistance.current = distanceInput
      onDistanceChange(distanceInput)
    }, DISTANCE_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [distanceInput, onDistanceChange])

  const handleSortClick = (field: SortField) => {
    const newDirection: SortDirection =
      filter.sortBy === field && filter.sortDirection === 'asc' ? 'desc' : 'asc'
    onSortChange(field, newDirection)
  }

  const sortIndicator = (field: SortField) =>
    filter.sortBy === field ? (filter.sortDirection === 'asc' ? '↑' : '↓') : ''

  const hasActiveFilters =
    filter.search ||
    filter.symbolFilter ||
    filter.maxDistance !== DEFAULT_CONFIG.maxDistanceKm ||
    filter.stationMaxAgeHours !== 24 ||
    !filter.rfOnly

  const healthLabel = !health
    ? 'Checking'
    : health.healthy
      ? 'Healthy'
      : health.sourceConnected
        ? 'No Data'
        : 'Source Down'

  const healthClass = !health
    ? 'toolbar-health-checking'
    : health.healthy
      ? 'toolbar-health-healthy'
      : 'toolbar-health-unhealthy'

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <span className="toolbar-label">Health</span>
        <span className={`toolbar-health ${healthClass}`}>{healthLabel}</span>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <input
          type="text"
          placeholder="Search callsign..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="toolbar-input toolbar-search"
        />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <span className="toolbar-label">Distance</span>
        <input
          type="range"
          min={10}
          max={DEFAULT_CONFIG.maxDistanceKm}
          step={10}
          value={distanceInput}
          onChange={(e) => setDistanceInput(Number(e.target.value))}
          className="toolbar-slider"
        />
        <span className="toolbar-value">{distanceInput}km</span>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <span className="toolbar-label">Age</span>
        <select
          value={filter.stationMaxAgeHours}
          onChange={(e) => onStationAgeChange(Number(e.target.value))}
          className="toolbar-select"
        >
          {STATION_AGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="toolbar-group">
        <span className="toolbar-label">Trail</span>
        <select
          value={filter.trailMaxAgeHours}
          onChange={(e) => onTrailAgeChange(Number(e.target.value))}
          className="toolbar-select"
        >
          {TRAIL_AGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="toolbar-divider" />

      <select
        value={filter.symbolFilter ?? ''}
        onChange={(e) => onSymbolChange(e.target.value || null)}
        className="toolbar-select toolbar-select-wide"
      >
        <option value="">All types</option>
        {availableSymbols.map((symbol) => (
          <option key={symbol} value={symbol}>
            {APRS_SYMBOLS[symbol]?.emoji ?? symbol} {APRS_SYMBOLS[symbol]?.name ?? 'Unknown'}
          </option>
        ))}
      </select>

      <div className="toolbar-divider" />

      {kissConnected && (
        <>
          <label className="toolbar-checkbox">
            <input
              type="checkbox"
              checked={filter.rfOnly}
              onChange={(e) => onRfOnlyChange(e.target.checked)}
            />
            <span>RF only</span>
          </label>

          <label className="toolbar-checkbox">
            <input
              type="checkbox"
              checked={filter.directOnly}
              onChange={(e) => onDirectOnlyChange(e.target.checked)}
            />
            <span>Direct</span>
          </label>

          <div className="toolbar-divider" />
        </>
      )}

      <div className="toolbar-sort-group">
        {(['callsign', 'distance', 'lastHeard'] as SortField[]).map((field) => (
          <button
            key={field}
            type="button"
            onClick={() => handleSortClick(field)}
            className={`toolbar-sort-btn ${filter.sortBy === field ? 'active' : ''}`}
          >
            {field === 'lastHeard' ? 'Time' : field.charAt(0).toUpperCase() + field.slice(1)}
            {sortIndicator(field) && <span className="sort-indicator">{sortIndicator(field)}</span>}
          </button>
        ))}
      </div>

      <div className="toolbar-spacer" />

      {hasActiveFilters && (
        <button
          type="button"
          onClick={onReset}
          className="toolbar-filter-warning"
          title="One or more filters are hiding stations. Click to clear all filters."
        >
          <TriangleAlert size={12} aria-hidden="true" />
          <span>Filters active — Reset</span>
        </button>
      )}

      <div className="toolbar-links">
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="toolbar-icon-link"
          title="Documentation (README)"
          aria-label="Documentation"
        >
          <BookOpen size={14} aria-hidden="true" />
        </a>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="toolbar-icon-link"
          title="GitHub repository"
          aria-label="GitHub repository"
        >
          <Github size={14} aria-hidden="true" />
        </a>
      </div>
    </div>
  )
}

export const Toolbar: FC<ToolbarProps> = memo(ToolbarInner)
