export function vibrar(ms = 10) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms)
  } catch {
    // Algunos navegadores lo prohíben sin gesto; no pasa nada.
  }
}
