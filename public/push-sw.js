// Avisos push de Perletta. Se importa desde el service worker que genera
// vite-plugin-pwa (workbox.importScripts), así que no puede usar imports.

self.addEventListener('push', (evento) => {
  let datos = {}
  try { datos = evento.data ? evento.data.json() : {} } catch { /* texto plano o vacío */ }

  evento.waitUntil(self.registration.showNotification(datos.title || 'Perletta', {
    body: datos.body || 'Tienes tu propuesta de hoy.',
    icon: '/icono-192.png',
    badge: '/icono-192.png',
    lang: 'es',
    data: { url: datos.url || '/?vista=hoy' },
  }))
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const destino = new URL(evento.notification.data?.url || '/?vista=hoy', self.location.origin).href

  evento.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const ventana of ventanas) {
      if (new URL(ventana.url).origin !== self.location.origin) continue
      await ventana.focus()
      if ('navigate' in ventana) await ventana.navigate(destino)
      return
    }
    await self.clients.openWindow(destino)
  })())
})
