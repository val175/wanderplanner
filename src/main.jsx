import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { installGlobalErrorReporting } from './utils/errorReporter'
import { registerSW } from 'virtual:pwa-register'

installGlobalErrorReporting()

// registerType 'autoUpdate' gives the incoming service worker skipWaiting +
// clientsClaim, but the page it takes over from keeps running the JavaScript it
// already loaded. The auto-injected registerSW.js is a bare register() call with
// no controllerchange handler, so a deploy only surfaced on the visit *after*
// the one that fetched it — every user sat one release behind. This reloads once
// the new worker actually takes control.
registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
