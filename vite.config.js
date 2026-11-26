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
          { src: '/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      // El motor de IA (23 MB de wasm) no se precachea: se descarga al usar el recorte.
      workbox: {
        globIgnores: ['**/ort*'],
        maximumFileSizeToCacheInBytes: 5000000,
        runtimeCaching: [
          {
            // Fotos de Supabase: se guardan por su ruta, no por la URL entera, porque la firma
            // (el token) cambia cada vez. Así las ya vistas se abren sin conexión (en el avión).
            // Son inmutables (cada subida tiene su nombre), por eso sin revalidar.
            // Función y no expresión regular: para otro dominio, Workbox solo acepta una regex que
            // coincida desde el principio de la URL, y esta mira dentro de la ruta.
            urlPattern: ({ url }) => /\/storage\/v1\/(?:render\/image|object)\/sign\/prendas\//.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'prendas-fotos-v3',
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 60, purgeOnQuotaError: true },
              // Solo 200: una respuesta opaca (0) no se puede medir ni saber si fue un error.
              cacheableResponse: { statuses: [200] },
              plugins: [
                {
                  // Va dentro del Service Worker: no puede usar nada de fuera de esta función.
                  cacheKeyWillBeUsed: async ({ request }) => {
                    const u = new URL(request.url)
                    const ancho = u.searchParams.get('width')
                    return `${u.origin}${u.pathname}${ancho ? `?width=${ancho}` : ''}`
                  },
                },
              ],
            },
          },
          {
            urlPattern: /^https:\/\/(?:geocoding-api|archive-api|api)\.open-meteo\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'clima',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 },
            },
          },
        ],
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 30000,
  }
})