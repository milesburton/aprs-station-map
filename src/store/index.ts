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

import connectionReducer from './slices/connection-slice'
import dataReducer from './slices/data-slice'
import filterReducer from './slices/filter-slice'
import mapReducer from './slices/map-slice'
import uiReducer from './slices/ui-slice'

const rootReducer = combineReducers({
  filters: filterReducer,
  map: mapReducer,
  ui: uiReducer,
  data: dataReducer,
  connection: connectionReducer,
})

const persistConfig = {
  key: 'aprs-station-map',
  storage,
  whitelist: ['filters', 'map'],
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
