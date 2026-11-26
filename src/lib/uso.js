// Registro de uso sin esfuerzo: qué outfits planificados de esta semana siguen sin
// anotarse como puestos. Lógica pura; la consulta y la interfaz están en AvisoUso.

import { DIAS_LARGOS, desdeISO, isoLocal, lunesDe } from './fechas.js'

/** Primer día en que se mira si te pusiste un outfit planificado: el lunes de esta semana. */
export const desdeSemana = (hoyISO) => isoLocal(lunesDe(hoyISO))

/**
 * Outfits planificados (de la semana en curso, antes de hoy) en los que ninguna prenda
 * tiene un uso anotado ese día y que aún no has contestado. El más reciente primero.
 *
 * `conjuntos`: { id, nombre, fecha, conjunto_prenda: [{ prenda_id }] }
 * `usos`: { prenda_id, fecha }   `resueltos`: ids que ya has contestado
 */
export function outfitsSinUso(conjuntos, usos, hoyISO, resueltos = []) {
  const inicio = desdeSemana(hoyISO)
  const hechos = new Set((usos || []).map((u) => `${u.fecha}|${u.prenda_id}`))
  const contestados = new Set(resueltos)

  return (conjuntos || [])
    .filter((c) => c.fecha && c.fecha >= inicio && c.fecha < hoyISO && !contestados.has(c.id))
    .filter((c) => (c.conjunto_prenda || []).length > 0)
    .filter((c) => !c.conjunto_prenda.some((cp) => hechos.has(`${c.fecha}|${cp.prenda_id}`)))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
}

/** «lunes», «martes»... de un día YYYY-MM-DD. */
export function nombreDelDia(fechaISO) {
  return DIAS_LARGOS[(desdeISO(fechaISO).getDay() + 6) % 7]
}

/** «ayer», «anteayer» o «el martes», según lo lejos que esté. */
export function cuandoFue(fechaISO, hoyISO) {
  const dias = Math.round((desdeISO(hoyISO) - desdeISO(fechaISO)) / 86_400_000)
  if (dias === 1) return 'ayer'
  if (dias === 2) return 'anteayer'
  return `el ${nombreDelDia(fechaISO)}`
}

/** Usos nuevos que hay que insertar para ese día (los que ya estaban no se repiten). */
export function usosPorAnadir(prendaIds, fechaISO, usos) {
  const ya = new Set((usos || []).filter((u) => u.fecha === fechaISO).map((u) => u.prenda_id))
  return [...new Set(prendaIds)].filter((id) => !ya.has(id)).map((prenda_id) => ({ prenda_id, fecha: fechaISO }))
}

/** Postgres devuelve 23505 al repetir el índice único de una prenda y un día. */
export const esUsoDuplicado = (error) => Boolean(error) && String(error.code) === '23505'

/**
 * Inserta usos sin que un duplicado tumbe el lote: si el servidor choca con el
 * índice único, se reintenta fila a fila para conservar los demás. Devuelve el
 * error real o null (un duplicado cuenta como éxito: ya estaba anotado).
 */
export async function insertarUsos(supabase, filas) {
  if (!filas || filas.length === 0) return null
  let { error } = await supabase.from('usos').insert(filas)
  if (!error || !esUsoDuplicado(error)) return error || null
  if (filas.length === 1) return null
  let fallo = null
  for (const fila of filas) {
    const { error: err } = await supabase.from('usos').insert([fila])
    if (err && !esUsoDuplicado(err)) fallo = err
  }
  return fallo
}

// --- Respuestas ya dadas (en el móvil) ---------------------------------------

const CLAVE = 'armario_uso_resuelto'

export function leerResueltos() {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE))
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

export function guardarResuelto(id) {
  try {
    // Solo se recuerdan los últimos 60: la semana en curso nunca pasa de ahí.
    localStorage.setItem(CLAVE, JSON.stringify([...leerResueltos().filter((x) => x !== id), id].slice(-60)))
  } catch { /* modo privado: se volverá a preguntar, no pasa nada */ }
}
