import type { FC } from 'react'
import { APRS_SYMBOLS, DEFAULT_CONFIG } from '../constants'
import type { FilterState, SortDirection, SortField } from '../types'

interface FilterPanelProps {
  filter: FilterState
  availableSymbols: string[]
  onSearchChange: (search: string) => void
  onDistanceChange: (distance: number) => void
  onSymbolChange: (symbol: string | null) => void
  onSortChange: (field: SortField, direction: SortDirection) => void
  onReset: () => void
}

export const FilterPanel: FC<FilterPanelProps> = ({
  filter,
  availableSymbols,
  onSearchChange,
  onDistanceChange,
  onSymbolChange,
  onSortChange,
  onReset,
}) => {
  const handleSortClick = (field: SortField) => {
    const newDirection: SortDirection =
      filter.sortBy === field && filter.sortDirection === 'asc' ? 'desc' : 'asc'
    onSortChange(field, newDirection)
  }

  const sortIndicator = (field: SortField) =>
    filter.sortBy === field ? (filter.sortDirection === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <div className="filter-panel">
      <div className="filter-row">
        <input
          type="text"
          placeholder="Search callsign or comment..."
          value={filter.search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="filter-row">
        <label htmlFor="distance-filter">Max distance: {filter.maxDistance} km</label>
        <input
          id="distance-filter"
          type="range"
          min={10}
          max={DEFAULT_CONFIG.maxDistanceKm}
          step={10}
          value={filter.maxDistance}
          onChange={(e) => onDistanceChange(Number(e.target.value))}
          className="distance-slider"
        />
      </div>

      <div className="filter-row">
        <select
          value={filter.symbolFilter ?? ''}
          onChange={(e) => onSymbolChange(e.target.value || null)}
          className="symbol-select"
        >
          <option value="">All symbols</option>
          {availableSymbols.map((symbol) => (
            <option key={symbol} value={symbol}>
              {symbol} {APRS_SYMBOLS[symbol]?.name ?? 'Unknown'}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-row sort-buttons">
        <button
          type="button"
          onClick={() => handleSortClick('callsign')}
          className={filter.sortBy === 'callsign' ? 'active' : ''}
        >
          Callsign{sortIndicator('callsign')}
        </button>
        <button
          type="button"
          onClick={() => handleSortClick('distance')}
          className={filter.sortBy === 'distance' ? 'active' : ''}
        >
          Distance{sortIndicator('distance')}
        </button>
        <button
          type="button"
          onClick={() => handleSortClick('lastHeard')}
          className={filter.sortBy === 'lastHeard' ? 'active' : ''}
        >
          Last heard{sortIndicator('lastHeard')}
        </button>
      </div>

      <button type="button" onClick={onReset} className="reset-button">
        Reset filters
      </button>
    </div>
  )
}
