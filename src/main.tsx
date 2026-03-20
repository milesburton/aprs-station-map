import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { persistor, store } from './store'
import './styles/index.css'
import { CLIENT_VERSION } from './utils/version'

const App = lazy(() => import('./App').then((m) => ({ default: m.App })))

console.log(`[Build] Version: ${CLIENT_VERSION}`)

const StartingFallback = () => (
  <div className="flex h-screen items-center justify-center bg-slate-900">
    <div className="text-center text-slate-300">
      <div className="text-lg font-semibold">Systems starting</div>
      <div className="mt-1 text-sm text-slate-400">Connecting&hellip;</div>
    </div>
  </div>
)

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <Suspense fallback={<StartingFallback />}>
          <App />
        </Suspense>
      </PersistGate>
    </Provider>
  )
} else {
  console.error('[Page] Root container not found!')
}
