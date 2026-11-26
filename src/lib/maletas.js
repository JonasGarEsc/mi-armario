/** Resumen de una maleta para la caché: lo justo para pintar la lista sin el árbol entero. */
export function resumenMaleta(maleta) {
  const urls = []
  for (const conjunto of maleta.conjuntos || []) {
    for (const cp of conjunto.conjunto_prenda || []) {
      const url = cp.prendas?.imagen_url
      if (url && !urls.includes(url)) urls.push(url)
    }
  }
  return {
    id: maleta.id,
    nombre: maleta.nombre,
    destino: maleta.destino ?? null,
    fecha_inicio: maleta.fecha_inicio ?? null,
    fecha_fin: maleta.fecha_fin ?? null,
    outfits: maleta.conjuntos?.length || 0,
    imagenes: urls.slice(0, 8),
  }
}

export const cacheMaletas = (lista) => lista.map((m) => (Array.isArray(m.conjuntos) ? resumenMaleta(m) : m))

/** Fotos y número total que enseña una maleta en la lista, venga de la caché o del árbol. */
export function extraerImagenesMaleta(maleta) {
  // La caché guarda un resumen (hasta 8 fotos y el total), no el árbol entero.
  if (Array.isArray(maleta.imagenes)) {
    return { imagenes: maleta.imagenes.slice(0, 8), total: maleta.outfits ?? maleta.imagenes.length }
  }
  if (!maleta.conjuntos) return { imagenes: [], total: 0 }
  const urls = []
  maleta.conjuntos.forEach(c => {
    if (c.conjunto_prenda) {
      c.conjunto_prenda.forEach(cp => {
        if (cp.prendas?.imagen_url && !urls.includes(cp.prendas.imagen_url)) {
          urls.push(cp.prendas.imagen_url)
        }
      })
    }
  })
  // Dentro de la maleta caben ocho fotos; el total cuenta todas las prendas.
  return { imagenes: urls.slice(0, 8), total: urls.length }
}

/** Reparto de las fotos dobladas dentro de la maleta: columnas, filas y tamaño de cada pieza. */
export function composicionMaleta(imagenes) {
  const columnas = imagenes.length > 2 ? 2 : 1
  const filas = Math.ceil(imagenes.length / columnas)
  // De cinco en adelante, filas ordenadas: solape leve y casi sin giro.
  const llena = imagenes.length > 4
  const ancho = columnas === 1 ? 100 : llena ? 52 : 62
  const alto = filas === 1 ? 100 : 100 / filas + (llena ? 3 : 14)
  return { columnas, filas, llena, ancho, alto }
}
