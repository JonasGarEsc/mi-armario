// Estado de una prenda dentro de un outfit: posición, capa, hueco del maniquí, escala
// (pellizco) y si la camiseta va por dentro. Lógica pura y guardado con respaldo.

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

/**
 * Las filas que se prueban al guardar, de la más completa a la más básica: así sigue
 * funcionando con una base de datos que aún no tiene las columnas nuevas o `ranura`.
 */
export function intentosDeGuardado(fila) {
  const intentos = [fila]
  const sinExtras = { ...fila }
  delete sinExtras.escala
  delete sinExtras.por_dentro
  if (Object.keys(sinExtras).length !== Object.keys(fila).length) intentos.push(sinExtras)
  if ('ranura' in sinExtras) {
    const sinRanura = { ...sinExtras }
    delete sinRanura.ranura
    intentos.push(sinRanura)
  }
  return intentos
}

/** Guarda el estado de una prenda en su outfit. Devuelve true si se pudo. */
export async function guardarEstadoPrenda(supabase, { conjuntoId, prendaId, x, y, z, ranura, extra }) {
  const fila = { pos_x: x, pos_y: y, z_index: z }
  if (ranura !== undefined) fila.ranura = ranura
  if (extra?.escala !== undefined) fila.escala = escalaParaGuardar(extra.escala)
  if (extra?.por_dentro !== undefined) fila.por_dentro = Boolean(extra.por_dentro)

  for (const intento of intentosDeGuardado(fila)) {
    const { error } = await supabase.from('conjunto_prenda').update(intento).match({ conjunto_id: conjuntoId, prenda_id: prendaId })
    if (!error) return true
  }
  return false
}
