import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { BrandingProvider } from './context/BrandingProvider'
import { ToastProvider } from './context/ToastContext'
import './index.css'
import App from './App.tsx'

// The PWA cache is for browsers. In the Capacitor shell the assets are already local
// and the injected registerSW.js fails with an uncaught "unknown error when fetching sw.js".
if ('serviceWorker' in navigator && !(window as any).Capacitor?.isNativePlatform?.()) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // A stale or blocked worker must never break the app.
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <BrandingProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </BrandingProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)