// Decisiones de los gestos táctiles, separadas para poder probarlas.

/**
 * Panel en el que debe acabar un deslizamiento: pasa al siguiente si se
 * arrastra más de un cuarto de pantalla o si se lanza con velocidad
 * (px/ms), aunque el recorrido sea corto.
 */
export function destinoDelGesto(indice, total, desplazamiento, velocidad, ancho) {
  const LANZAR = 0.35
  const RECORRIDO = 0.25 * ancho
  let destino = indice
  if (desplazamiento < -RECORRIDO || velocidad < -LANZAR) destino = indice + 1
  else if (desplazamiento > RECORRIDO || velocidad > LANZAR) destino = indice - 1
  // Un lanzamiento hacia un lado con el dedo yendo hacia el otro no cuenta.
  if (Math.sign(destino - indice) === Math.sign(desplazamiento)) destino = indice
  return Math.min(total - 1, Math.max(0, destino))
}

/** ¿Se cierra la hoja al soltarla? Si baja bastante o se lanza hacia abajo. */
export function cerrarHoja(desplazamiento, velocidad, alto) {
  return desplazamiento > Math.min(140, alto * 0.25) || (velocidad > 0.5 && desplazamiento > 12)
}

/**
 * Animación para recorrer `falta` px al soltar el dedo, sin cambio brusco de
 * velocidad: la duración depende de la distancia y la curva se ajusta para
 * que arranque justo a la velocidad que llevaba el dedo (px/ms) y frene suave
 * al llegar, como en iOS. Devuelve { duracion (ms), curva (cubic-bezier) }.
 */
export function curvaAsentamiento(falta, velocidad) {
  const distancia = Math.abs(falta)
  if (distancia < 1) return { duracion: 0, curva: 'linear' }
  const duracion = Math.min(460, Math.max(280, 240 + 0.5 * distancia))
  // Velocidad inicial que pide el dedo, relativa a la media de la animación.
  const aFavor = velocidad && Math.sign(velocidad) === Math.sign(falta) ? Math.abs(velocidad) : 0
  const pendiente = (aFavor * duracion) / distancia
  // cubic-bezier(x1, y1, 0.36, 1): la pendiente inicial es y1 / x1.
  let x1 = 0.22
  let y1 = pendiente * x1
  if (y1 > 1) { y1 = 1; x1 = 1 / pendiente }
  const r = (n) => Math.round(n * 1000) / 1000
  return { duracion: Math.round(duracion), curva: `cubic-bezier(${r(x1)}, ${r(y1)}, 0.36, 1)` }
}
