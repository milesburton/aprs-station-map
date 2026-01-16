import type { FC } from 'react'
import { APRS_SYMBOLS, DEFAULT_CONFIG } from '../constants'
import type { FilterState, SortDirection, SortField } from '../types'

interface ToolbarProps {
  filter: FilterState
  availableSymbols: string[]
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

export const Toolbar: FC<ToolbarProps> = ({
  filter,
  availableSymbols,
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

  return (
    <div className="toolbar">
      {/* Search */}
      <div className="toolbar-group">
        <input
          type="text"
          placeholder="Search callsign..."
          value={filter.search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="toolbar-input toolbar-search"
        />
      </div>

      <div className="toolbar-divider" />

      {/* Distance */}
      <div className="toolbar-group">
        <span className="toolbar-label">Distance</span>
        <input
          type="range"
          min={10}
          max={DEFAULT_CONFIG.maxDistanceKm}
          step={10}
          value={filter.maxDistance}
          onChange={(e) => onDistanceChange(Number(e.target.value))}
          className="toolbar-slider"
        />
        <span className="toolbar-value">{filter.maxDistance}km</span>
      </div>

      <div className="toolbar-divider" />

      {/* Station age */}
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

      {/* Trail age */}
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

      {/* Symbol filter */}
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

      {/* Checkboxes */}
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

      {/* Sort buttons */}
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

      {/* Reset */}
      {hasActiveFilters && (
        <button type="button" onClick={onReset} className="toolbar-reset-btn">
          Reset
        </button>
      )}
    </div>
  )
}
