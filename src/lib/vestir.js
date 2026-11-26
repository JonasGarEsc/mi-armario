// Coloca la foto de una prenda sobre el maniquí con un tamaño realista.
// Trabaja en porcentajes del escenario cuadrado (0-100 en ambos ejes).
//
// Cada prenda se adapta por separado: el LARGO sale del tipo de prenda (un
// top acaba sobre el ombligo, una camiseta en la cadera, un abrigo en la
// rodilla) y el ANCHO de medir en la foto el cuerpo de la prenda, sin mangas,
// para que coincida con el del maniquí. Si eso obliga a deformar mucho la
// foto, se cede en el ancho para que no se vea aplastada ni estirada.

import { VESTIR } from './maniqui.js'

// Cuánto puede apartarse la foto de sus proporciones naturales (alto/ancho
// relativo, ya contada la envoltura). 1 = sin deformar.
export const DEFORMACION = [0.7, 1.35]

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

const normalizar = (textos) =>
  textos.map((t) => (t ? String(t).toLowerCase() : ''))

/** Regla de VESTIR para una prenda: una falda no se viste como un pantalón. */
export function reglaDePrenda(ranura, textos = []) {
  const t = normalizar(textos)
  if (ranura === 'piernas' && t.some((x) => /falda/.test(x))) return VESTIR.falda
  return VESTIR[ranura] || null
}

/** Altura del bajo según el nombre, la categoría o el tipo (en ese orden). */
export function largoPorNombre(regla, textos = []) {
  const t = normalizar(textos)
  for (let i = 0; i < t.length; i++) {
    if (!t[i]) continue
    for (const [patron, bajo, soloNombre] of regla.largos || []) {
      if (soloNombre && i > 0) continue
      if (patron.test(t[i])) return bajo
    }
  }
  return null
}

const masCercano = (lista, valor) =>
  lista.reduce((mejor, v) => (Math.abs(v - valor) < Math.abs(mejor - valor) ? v : mejor))

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
 * la prenda vista al maniquí. `textos` = [nombre, categoría, tipo].
 * Devuelve null si no hay regla o no hay medidas.
 */
export function vestirPrenda(caja, ranura, textos = []) {
  const regla = reglaDePrenda(ranura, textos)
  if (!regla || !caja || !(caja.w > 0) || !(caja.h > 0)) return null
  const relacion = caja.relacion > 0 ? caja.relacion : 1

  if (regla.zona) return caberEnZona(caja, relacion, regla.zona, regla.ancla)

  const envoltura = regla.envoltura ?? 1

  // Ancho: lo que mide el cuerpo de la prenda debe coincidir con el maniquí.
  const medida = medirAnchura(caja, regla.filas[0], regla.filas[1], regla.percentil)
  let anchoFoto = medida ? regla.ancho / medida : null

  // Largo: por el nombre; si no lo dice, el largo realista más parecido al
  // que tendría la foto sin deformar.
  let bajo = largoPorNombre(regla, textos)
  if (bajo === null) {
    if (medida) {
      // Relación largo/anchura de la prenda tal como sale en la foto.
      const esbeltez = caja.h / relacion / medida
      bajo = masCercano(regla.posibles, regla.arriba + esbeltez * regla.proporcion)
    } else {
      bajo = regla.defecto
    }
  }
  const altoFoto = ((bajo - regla.arriba) / caja.h) // alto de la foto entera

  // Sin perfil, se respetan las proporciones de la foto.
  const anchoNatural = altoFoto * relacion * envoltura
  if (!anchoFoto) anchoFoto = anchoNatural

  // Que no se vea aplastada ni estirada.
  const [menos, mas] = DEFORMACION
  anchoFoto = Math.min(anchoNatural / menos, Math.max(anchoNatural / mas, anchoFoto))
  if (caja.w * anchoFoto > regla.anchoMax) anchoFoto = regla.anchoMax / caja.w

  return {
    x: 50 - (caja.x + caja.w / 2) * anchoFoto,
    y: regla.arriba - caja.y * altoFoto,
    w: anchoFoto,
    h: altoFoto,
  }
}
