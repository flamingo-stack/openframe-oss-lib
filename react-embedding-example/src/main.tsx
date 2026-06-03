import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// ODS tokens + chat keyframes + fonts (CSS only). Import once, before any lib surface paints.
import '@flamingo-stack/openframe-frontend-core/styles'
import './index.css'
import { registerEmbedRouterBridge } from './providers/embed-router-bridge'
import { AppProviders } from './providers/app-providers'
import { AppRoutes } from './app-routes'

// Register the react-router → embed-shims bridge BEFORE the first lib surface renders,
// so lib pages navigate via react-router (not the popstate-only fallback).
registerEmbedRouterBridge()

// NOTE: intentionally NO <React.StrictMode>. This reference app's dev network
// panel is meant to mirror production exactly. StrictMode's dev-only double-invoke
// renders a throwaway "(cancelled)" fetch next to each real one (the lib hooks abort
// cleanly on the discarded first mount) — useful for catching effect bugs, noisy for
// a demo. The lib stays StrictMode-safe regardless; that's covered by its vitest suite.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  </BrowserRouter>,
)
