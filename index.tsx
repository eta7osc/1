import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Could not find root element to mount to')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`
    navigator.serviceWorker.register(swUrl).catch(err => {
      console.log('[SW] registration failed:', err)
    })
  })
}
