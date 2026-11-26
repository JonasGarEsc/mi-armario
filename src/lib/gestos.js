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
