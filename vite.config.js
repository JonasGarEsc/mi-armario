import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Armario Virtual',
        short_name: 'Perletta',
        description: 'Gestor de armario y maletas',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/logoPerletta.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      // Ampliación del límite de caché para el motor de IA
      workbox: {
        maximumFileSizeToCacheInBytes: 30000000
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 30000,
  }
})