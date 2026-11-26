// Coloca la foto de una prenda sobre el maniquí con un tamaño realista.
// Trabaja en porcentajes del escenario cuadrado (0-100 en ambos ejes).

import { VESTIR } from './maniqui.js'

/**
 * Anchura de la prenda (fracción del ancho de la foto) en un tramo de su
 * altura, a partir del perfil que guarda `cajaVisible`.
 */
export function medirAnchura(caja, desde, hasta, percentil = 0.5) {
  const perfil = caja?.perfil
  if (!Array.isArray(perfil) || perfil.length === 0) return null
  const n = perfil.length
  const inicio = Math.min(n - 1, Math.floor(desde * n))
  const fin = Math.max(inicio + 1, Math.ceil(hasta * n))
  const valores = perfil
    .slice(inicio, fin)
    .filter((v) => v > 0)
    .sort((a, b) => a - b)
  if (valores.length === 0) return null
  return valores[Math.round(percentil * (valores.length - 1))]
}

function caberEnZona(caja, relacion, zona, ancla) {
  const ancho = Math.min(zona.w / caja.w, (zona.h * relacion) / caja.h)
  const alto = ancho / relacion
  const x = zona.x + zona.w / 2 - (caja.x + caja.w / 2) * ancho
  const y = ancla === 'abajo'
    ? zona.y + zona.h - (caja.y + caja.h) * alto
    : zona.y + zona.h / 2 - (caja.y + caja.h / 2) * alto
  return { x, y, w: ancho, h: alto }
}

/**
 * Rectángulo (en % del escenario) que debe ocupar la foto completa para que
 * la prenda vista al maniquí. Devuelve null si no hay regla o no hay medidas.
 */
export function vestirPrenda(caja, ranura) {
  const regla = VESTIR[ranura]
  if (!regla || !caja || !(caja.w > 0) || !(caja.h > 0)) return null
  const relacion = caja.relacion > 0 ? caja.relacion : 1

  if (regla.zona) return caberEnZona(caja, relacion, regla.zona, regla.ancla)

  // `escala` es el tamaño de la foto entera tal como mide en plano; puesta,
  // se estrecha por la envoltura y conserva el largo.
  const envoltura = regla.envoltura ?? 1
  const medida = medirAnchura(caja, regla.filas[0], regla.filas[1], regla.percentil)
  let escala = medida
    ? regla.ancho / (medida * envoltura)
    : (regla.ancho * 1.3) / (caja.w * envoltura)

  // Salvaguardas: un largo y un ancho que tengan sentido en una persona.
  const largo = (caja.h * escala) / relacion
  if (largo < regla.alto[0]) escala *= regla.alto[0] / largo
  else if (largo > regla.alto[1]) escala *= regla.alto[1] / largo
  const anchoVisible = caja.w * escala * envoltura
  if (anchoVisible > regla.anchoMax) escala *= regla.anchoMax / anchoVisible

  const ancho = escala * envoltura
  const alto = escala / relacion
  return {
    x: 50 - (caja.x + caja.w / 2) * ancho,
    y: regla.arriba - caja.y * alto,
    w: ancho,
    h: alto,
  }
}
