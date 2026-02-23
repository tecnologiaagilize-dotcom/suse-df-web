import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import { Capacitor } from '@capacitor/core'

// Apenas registra o Service Worker se NÃO for nativo (Capacitor)
// Isso evita o erro de "failed to register serviceworker" no Android
if (!Capacitor.isNativePlatform()) {
  console.log("Ambiente Web detectado: Registrando Service Worker...");
  registerSW({ 
    immediate: true,
    onRegisterError: (error) => console.warn("Falha ao registrar SW (Web):", error)
  })
} else {
  console.log("Ambiente Nativo (Capacitor): Service Worker desativado.");
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
