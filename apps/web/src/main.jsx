import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import { Capacitor } from '@capacitor/core'

// Apenas registra o Service Worker se NÃO for nativo (Capacitor)
// Isso evita o erro de "failed to register serviceworker" no Android
if (!Capacitor.isNativePlatform()) {
  registerSW({ immediate: true })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
