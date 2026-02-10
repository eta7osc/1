import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/ios.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Could not find root element to mount to')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      registration.unregister().catch(() => {})
    })
  })
}

if ('caches' in window) {
  caches.keys().then(keys => {
    keys
      .filter(key => key.startsWith('lovers-secret-'))
      .forEach(key => {
        caches.delete(key).catch(() => {})
      })
  })
}
