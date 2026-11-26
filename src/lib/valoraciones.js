// Valoraciones de outfits: «me gusta» / «no me gusta» por combinación.
// La clave es la misma combinación estable que usa el resto de la app, así una
// propuesta valorada se reconoce aunque las prendas lleguen en otro orden.

import { claveCombinacion } from './outfits.js'

export const TABLA_VALORACIONES = 'valoraciones'

/** Clave estable de una combinación de prendas. */
export function claveDeOutfit(ids) {
  return claveCombinacion(ids || [])
}

/** Lo que vale tocar un botón: si ya estaba elegido, se quita (0). */
export function siguienteValor(actual, elegido) {
  return actual === elegido ? 0 : elegido
}

/** Copia del mapa con la valoración puesta (o quitada si `valor` no es 1 ni -1). */
export function conValoracion(mapa, clave, valor) {
  const siguiente = new Map(mapa || [])
  if (valor === 1 || valor === -1) siguiente.set(clave, valor)
  else siguiente.delete(clave)
  return siguiente
}

/** Todas las valoraciones del usuario. Si la consulta falla, no hay ninguna. */
export async function cargarValoraciones(supabase) {
  if (!supabase) return new Map()
  try {
    const { data, error } = await supabase.from(TABLA_VALORACIONES).select('clave, valor')
    if (error || !Array.isArray(data)) return new Map()
    return new Map(data.map((fila) => [fila.clave, fila.valor]))
  } catch {
    return new Map()
  }
}

/** Guarda (o borra) una valoración. Si falla, se devuelve `ok: false`. */
export async function guardarValoracion(supabase, clave, valor) {
  if (!supabase || !clave) return { ok: false }
  try {
    const consulta = valor === 0
      ? supabase.from(TABLA_VALORACIONES).delete().eq('clave', clave)
      : supabase.from(TABLA_VALORACIONES).upsert({ clave, valor }, { onConflict: 'user_id,clave' })
    const { error } = await consulta
    return error ? { ok: false } : { ok: true }
  } catch {
    return { ok: false }
  }
}
