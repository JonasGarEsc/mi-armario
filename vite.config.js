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
        name: 'Perletta — armario y maletas',
        short_name: 'Perletta',
        description: 'Tu armario y tus maletas: qué tienes, qué te pones y qué te llevas.',
        lang: 'es',
        theme_color: '#f6f6f7',
        background_color: '#f6f6f7',
        display: 'standalone',
        icons: [
          { src: '/icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
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