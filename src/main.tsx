import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initErrorLog } from './lib/errorlog'

// Virheloki päälle heti: kentällä kaatunut virhe tallentuu kantaan
initErrorLog()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA: service worker mahdollistaa "Asenna sovellus" / "Lisää kotinäytölle" -asennuksen
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Asennus ilman service workeria toimii silti useimmilla laitteilla
    })
  })
}
