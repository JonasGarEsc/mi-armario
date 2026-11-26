// Estado de una prenda dentro de un outfit: posición, capa, hueco del maniquí, escala
// (pellizco) y si la camiseta va por dentro. Lógica pura y guardado.

export const ESCALA_MIN = 0.8
export const ESCALA_MAX = 1.2

/** Escala dentro del rango permitido (±20 %). */
export const limitarEscala = (e) => {
  const n = Number(e)
  return Number.isFinite(n) ? Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, n)) : 1
}

/** Escala tras un pellizco: la de partida por lo que ha crecido la distancia entre dedos. */
export function escalaDePellizco(escalaInicial, distanciaInicial, distanciaActual) {
  if (!(distanciaInicial > 0)) return limitarEscala(escalaInicial)
  return limitarEscala(escalaInicial * (distanciaActual / distanciaInicial))
}

/** Distancia entre dos puntos { x, y }. */
export const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

/** Escala redondeada (dos decimales) lista para guardar. */
export const escalaParaGuardar = (e) => Math.round(limitarEscala(e) * 100) / 100

/** Guarda el estado de una prenda en su outfit. Devuelve true si se pudo. */
export async function guardarEstadoPrenda(supabase, { conjuntoId, prendaId, x, y, z, ranura, extra }) {
  const fila = { pos_x: x, pos_y: y, z_index: z }
  if (ranura !== undefined) fila.ranura = ranura
  if (extra?.escala !== undefined) fila.escala = escalaParaGuardar(extra.escala)
  if (extra?.por_dentro !== undefined) fila.por_dentro = Boolean(extra.por_dentro)

  const { error } = await supabase.from('conjunto_prenda').update(fila).match({ conjunto_id: conjuntoId, prenda_id: prendaId })
  return !error
}
