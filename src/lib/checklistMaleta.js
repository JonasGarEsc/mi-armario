// Lista de la maleta: prendas ya metidas (casillas) y cosas que no son ropa.
// Vive en la tabla maleta_extras; si todavía no existe (falta actualizacion-v4.sql),
// sigue funcionando en el móvil como antes.

import { leerCache, guardarCache } from './cache.js'

const claveMarcadas = (id) => `checklist_${id}`
const claveExtras = (id) => `extras_${id}`

/** Texto de una cosa de la lista, sin espacios de más y con tope de longitud. */
export const limpiarTexto = (t) => String(t ?? '').trim().replace(/\s+/g, ' ').slice(0, 80)

/** ¿Ya está ese texto en la lista? (sin distinguir mayúsculas ni acentos) */
export function yaEsta(extras, texto) {
  const norma = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return extras.some((e) => norma(e.texto) === norma(texto))
}

/** Las que faltan por meter: ni las marcadas ni las ya hechas cuentan. */
export const pendientes = (extras, marcadas, prendas) => ({
  extras: extras.filter((e) => !e.hecho).length,
  prendas: prendas.filter((p) => !marcadas.includes(p.id)).length,
})

/** Lee la lista. { extras, marcadas, local } — local = sin tabla, guardado solo en el móvil. */
export async function leerChecklist(supabase, maletaId) {
  const { data, error } = await supabase.from('maleta_extras').select('id, texto, prenda_id, hecho').eq('maleta_id', maletaId).order('creado_en')
  const guardadas = leerCache(claveMarcadas(maletaId))

  if (error) {
    const extras = leerCache(claveExtras(maletaId))
    return { extras: Array.isArray(extras) ? extras : [], marcadas: Array.isArray(guardadas) ? guardadas : [], local: true }
  }

  const filas = data || []
  let marcadas = filas.filter((f) => f.prenda_id && f.hecho).map((f) => f.prenda_id)

  // Migración: las casillas que había en el móvil pasan a la base de datos.
  if (Array.isArray(guardadas) && guardadas.length > 0) {
    const nuevas = guardadas.filter((id) => !marcadas.includes(id))
    if (nuevas.length > 0) {
      const { error: errMigrar } = await supabase.from('maleta_extras')
        .upsert(nuevas.map((prenda_id) => ({ maleta_id: maletaId, prenda_id, hecho: true })), { onConflict: 'maleta_id,prenda_id' })
      if (!errMigrar) marcadas = [...marcadas, ...nuevas]
    }
    guardarCache(claveMarcadas(maletaId), null)
  }

  return { extras: filas.filter((f) => f.texto).map(({ id, texto, hecho }) => ({ id, texto, hecho })), marcadas, local: false }
}

export async function guardarMarcada(supabase, maletaId, prendaId, hecho, { local, marcadas }) {
  if (local) { guardarCache(claveMarcadas(maletaId), marcadas); return true }
  const r = hecho
    ? await supabase.from('maleta_extras').upsert([{ maleta_id: maletaId, prenda_id: prendaId, hecho: true }], { onConflict: 'maleta_id,prenda_id' })
    : await supabase.from('maleta_extras').delete().eq('maleta_id', maletaId).eq('prenda_id', prendaId)
  return !r.error
}

export async function guardarExtraHecho(supabase, maletaId, extra, { local, extras }) {
  if (local) { guardarCache(claveExtras(maletaId), extras); return true }
  const { error } = await supabase.from('maleta_extras').update({ hecho: extra.hecho }).eq('id', extra.id)
  return !error
}

/** Añade cosas a la lista; las que ya estaban se saltan. Devuelve las nuevas { id, texto, hecho }. */
export async function anadirExtras(supabase, maletaId, textos, { local, extras }) {
  const nuevos = []
  for (const t of textos.map(limpiarTexto).filter(Boolean)) {
    if (!yaEsta([...extras, ...nuevos], t)) nuevos.push({ texto: t, hecho: false })
  }
  if (nuevos.length === 0) return []

  if (local) {
    const conId = nuevos.map((n) => ({ ...n, id: `local-${Math.random().toString(36).slice(2, 10)}` }))
    guardarCache(claveExtras(maletaId), [...extras, ...conId])
    return conId
  }
  const { data, error } = await supabase.from('maleta_extras')
    .insert(nuevos.map((n) => ({ maleta_id: maletaId, texto: n.texto }))).select('id, texto, hecho')
  return error ? null : data
}

export async function quitarExtra(supabase, maletaId, extra, { local, extras }) {
  if (local) { guardarCache(claveExtras(maletaId), extras); return true }
  const { error } = await supabase.from('maleta_extras').delete().eq('id', extra.id)
  return !error
}
