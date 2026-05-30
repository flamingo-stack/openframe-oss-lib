import React from 'react'
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  </React.StrictMode>,
)
