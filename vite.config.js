import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // INICIO DE LA NUEVA CONFIGURACIÓN DE CACHÉ
      workbox: {
        runtimeCaching: [
          {
            // Intercepta las imágenes de Supabase
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-imagenes-armario',
              expiration: {
                maxEntries: 300, // Guarda hasta 300 prendas
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 días de caducidad
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      // FIN DE LA NUEVA CONFIGURACIÓN
      manifest: {
        name: 'Armario Virtual',
        short_name: 'Perletta',
        description: 'Gestor de armario y maletas',
        theme_color: '#000000',
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
      }
    })
  ]
})