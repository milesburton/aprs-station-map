import { DEFAULT_CONFIG, DEFAULT_FILTER_STATE } from '../constants'
import type { FilterState, MapState } from '../types'

interface UrlState {
  filter: Partial<FilterState>
  map: Partial<MapState>
}

export const encodeUrlState = (filter: FilterState, map: MapState): string => {
  const params = new URLSearchParams()

  filter.search !== '' && params.set('q', filter.search)
  filter.maxDistance !== DEFAULT_FILTER_STATE.maxDistance &&
    params.set('d', filter.maxDistance.toString())
  filter.symbolFilter !== null && params.set('sym', filter.symbolFilter)
  filter.sortBy !== DEFAULT_FILTER_STATE.sortBy && params.set('sort', filter.sortBy)
  filter.sortDirection !== DEFAULT_FILTER_STATE.sortDirection &&
    params.set('dir', filter.sortDirection)

  map.selectedStation !== null && params.set('station', map.selectedStation)
  map.zoom !== DEFAULT_CONFIG.defaultZoom && params.set('z', map.zoom.toString())
  params.set('lat', map.centre.latitude.toFixed(4))
  params.set('lng', map.centre.longitude.toFixed(4))

  return params.toString()
}

export const decodeUrlState = (search: string): UrlState => {
  const params = new URLSearchParams(search)

  return {
    filter: {
      search: params.get('q') ?? undefined,
      maxDistance: params.has('d') ? Number(params.get('d')) : undefined,
      symbolFilter: params.get('sym') ?? undefined,
      sortBy: (params.get('sort') as FilterState['sortBy']) ?? undefined,
      sortDirection: (params.get('dir') as FilterState['sortDirection']) ?? undefined,
    },
    map: {
      selectedStation: params.get('station') ?? undefined,
      zoom: params.has('z') ? Number(params.get('z')) : undefined,
      centre:
        params.has('lat') && params.has('lng')
          ? { latitude: Number(params.get('lat')), longitude: Number(params.get('lng')) }
          : undefined,
    },
  }
}

let updateTimeout: ReturnType<typeof setTimeout> | null = null

export const updateUrlState = (filter: FilterState, map: MapState): void => {
  updateTimeout !== null && clearTimeout(updateTimeout)

  updateTimeout = setTimeout(() => {
    const encoded = encodeUrlState(filter, map)
    const newUrl = `${window.location.pathname}${encoded ? `?${encoded}` : ''}`
    window.history.replaceState(null, '', newUrl)
  }, 500)
}
