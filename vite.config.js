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
      includeAssets: ['favicon.svg'],
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
      // El motor de IA (23 MB de wasm) no se precachea: se descarga al usar el recorte.
      workbox: {
        globIgnores: ['**/ort*'],
        maximumFileSizeToCacheInBytes: 5000000
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 30000,
  }
})