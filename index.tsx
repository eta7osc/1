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
  window.addEventListener('load', () => {
    const rawBase = (import.meta.env.BASE_URL || '/').trim()
    const scope = rawBase.endsWith('/') ? rawBase : `${rawBase}/`

    navigator.serviceWorker.register(`${scope}sw.js`, { scope }).catch(err => {
      console.warn('[SW] register failed', err)
    })
  })
}
