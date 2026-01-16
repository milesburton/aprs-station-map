import { combineReducers, configureStore } from '@reduxjs/toolkit'
import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  persistReducer,
  persistStore,
  REGISTER,
  REHYDRATE,
} from 'redux-persist'
import storage from 'redux-persist/lib/storage'

import connectionReducer from './slices/connectionSlice'
import dataReducer from './slices/dataSlice'
import filterReducer from './slices/filterSlice'
import mapReducer from './slices/mapSlice'
import uiReducer from './slices/uiSlice'

const rootReducer = combineReducers({
  filters: filterReducer,
  map: mapReducer,
  ui: uiReducer,
  data: dataReducer,
  connection: connectionReducer,
})

// Persist config - only persist filters, map, and ui
// Data and connection are ephemeral (WebSocket-driven)
const persistConfig = {
  key: 'aprs-station-map',
  storage,
  whitelist: ['filters', 'map', 'ui'],
  // Blacklist search from filters (transient)
  // This is handled at the slice level via transforms if needed
}

const persistedReducer = persistReducer(persistConfig, rootReducer)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
  devTools: import.meta.env.DEV,
})

export const persistor = persistStore(store)

export type RootState = ReturnType<typeof rootReducer>
export type AppDispatch = typeof store.dispatch
