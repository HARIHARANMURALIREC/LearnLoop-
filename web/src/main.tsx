import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Installable PWA + offline app shell (production only, so dev hot-reload isn't cached).
if ('serviceWorker' in navigator && import.meta.env.PROD) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => { /* not fatal */ }))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
