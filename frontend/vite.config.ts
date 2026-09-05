import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const proxyTarget = process.env.VITE_PROXY_TARGET || process.env.VITE_API_BASE || 'http://localhost:8080'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'SamStack AI - Hospital CRM',
        short_name: 'SamStackCRM',
        description: 'Doctor / Clinic CRM by Samstack',
        theme_color: '#0d9488',
        icons: [
          { src: '/favicon.svg', sizes: '192x192', type: 'image/svg+xml' }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false
      },
      '/lab-uploads': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false
      }
    }
  }
})