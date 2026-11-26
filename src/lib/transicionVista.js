// Transición de la foto de la tarjeta a la foto de la ficha. El nombre es
// único por prenda y solo lo llevan los dos elementos que viajan. Sin la API
// del navegador (o con movimiento reducido) se abre sin animación.

export const nombreVistaPrenda = (id) => `foto-prenda-${String(id ?? '').replace(/[^a-zA-Z0-9_-]/g, '')}`

export function movimientoReducido(ventana = globalThis.window) {
  try {
    return Boolean(ventana?.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  } catch {
    return false
  }
}

/**
 * Ejecuta `cambiar` dentro de una View Transition si el navegador la admite.
 * Devuelve la transición (con `.finished`) o null si se abrió sin animación.
 */
export function conTransicionVista(cambiar, { ventana = globalThis.window, documento = globalThis.document } = {}) {
  const empezar = documento?.startViewTransition
  if (typeof empezar !== 'function' || movimientoReducido(ventana)) {
    cambiar()
    return null
  }
  try {
    return empezar.call(documento, cambiar)
  } catch {
    cambiar()
    return null
  }
}
