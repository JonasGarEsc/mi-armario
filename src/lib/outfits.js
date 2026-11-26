// Misma combinación de prendas da la misma clave, sin importar el orden ni el tipo del id.
export function claveCombinacion(ids) {
  return [...ids].map(String).sort().join(',')
}

export function esDuplicado(conjuntos, ids) {
  if (!conjuntos) return false
  const objetivo = claveCombinacion(ids)
  return conjuntos.some(c => claveCombinacion((c.conjunto_prenda || []).map(cp => cp.prenda_id)) === objetivo)
}

export function limitarPosicion(x, y, ancho, alto, tam) {
  const maxX = Math.max(0, ancho - tam)
  const maxY = Math.max(0, alto - tam)
  return {
    x: Math.min(Math.max(x, 0), maxX),
    y: Math.min(Math.max(y, 0), maxY)
  }
}

// Las prendas sueltas guardan su posición como fracción del lienzo (0-1), así
// no se descolocan en pantallas de otro tamaño. Las guardadas antes iban en
// píxeles, que en la práctica siempre superan 1 (la base pone 40 y 20 por
// defecto); un valor en píxeles entre 0 y 1 está pegado al borde igualmente.
export function esPosicionEnPixeles(x, y) {
  return x > 1 || y > 1
}

/** Píxeles dentro del lienzo → fracción, sin salirse por los bordes. */
export function aFraccion(x, y, ancho, alto, tam) {
  if (!(ancho > 0) || !(alto > 0)) return { x: 0, y: 0 }
  const dentro = limitarPosicion(x, y, ancho, alto, tam)
  return { x: dentro.x / ancho, y: dentro.y / alto }
}
