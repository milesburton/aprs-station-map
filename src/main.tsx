import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/index.css'

import { CLIENT_VERSION } from './utils/version'

console.log(`[Build] Version: ${CLIENT_VERSION}`)
console.log('[Page] Script loaded, readyState:', document.readyState)

// Log page load events
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    console.log('[Page] DOMContentLoaded')
  })
} else {
  console.log('[Page] DOMContentLoaded already fired')
}

if (document.readyState !== 'complete') {
  window.addEventListener('load', () => {
    console.log('[Page] Load complete')
  })
} else {
  console.log('[Page] Load already complete')
}

// Debug: log any navigation/unload events
window.addEventListener('beforeunload', () => {
  console.log('[Page] beforeunload event fired!')
})
window.addEventListener('pagehide', () => {
  console.log('[Page] pagehide event fired!')
})
window.addEventListener('visibilitychange', () => {
  console.log('[Page] visibilitychange:', document.visibilityState)
})

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(<App />)
} else {
  console.error('[Page] Root container not found!')
}
