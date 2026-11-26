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
