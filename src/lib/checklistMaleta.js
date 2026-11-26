// Lista de la maleta: prendas ya metidas (casillas) y cosas que no son ropa.
// Vive en la tabla maleta_extras; los datos que quedaran solo en el móvil se
// migran a la base de datos y se conservan las copias para usar sin red.

import { leerCache, guardarCache } from './cache.js'
import { ejecutarOperacion, esErrorDeRed } from './colaOffline.js'

const claveMarcadas = (id) => `checklist_${id}`
const claveExtras = (id) => `extras_${id}`
const claveSnapshot = (id) => `checklistdb_${id}`

const norma = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Texto de una cosa de la lista, sin espacios de más y con tope de longitud. */
export const limpiarTexto = (t) => String(t ?? '').trim().replace(/\s+/g, ' ').slice(0, 80)

/** ¿Ya está ese texto en la lista? (sin distinguir mayúsculas ni acentos) */
export function yaEsta(extras, texto) {
  return extras.some((e) => norma(e.texto) === norma(texto))
}

/** Las que faltan por meter: ni las marcadas ni las ya hechas cuentan. */
export const pendientes = (extras, marcadas, prendas) => ({
  extras: extras.filter((e) => !e.hecho).length,
  prendas: prendas.filter((p) => !marcadas.includes(p.id)).length,
})

const unirExtras = (...listas) => {
  const salida = []
  for (const lista of listas) {
    for (const extra of Array.isArray(lista) ? lista : []) {
      if (extra?.texto && !yaEsta(salida, extra.texto)) salida.push(extra)
    }
  }
  return salida
}

const unirMarcadas = (...listas) => [...new Set(listas.flatMap((l) => (Array.isArray(l) ? l : [])))]

// Sin escribir() inyectado (tests, otros usos) se hace la operación directamente.
const directo = async (supabase, op) => ((await ejecutarOperacion(supabase, op)).error ? 'error' : 'hecha')
const via = (supabase, escribir) => escribir || ((op) => directo(supabase, op))
const ok = (estado) => estado !== 'error'

/**
 * Lee la lista. { extras, marcadas, sinConexion, error }.
 * Sin conexión se enseña la última copia vista.
 */
export async function leerChecklist(supabase, maletaId) {
  const { data, error } = await supabase.from('maleta_extras').select('id, texto, prenda_id, hecho').eq('maleta_id', maletaId).order('creado_en')
  const guardadas = leerCache(claveMarcadas(maletaId))
  const locales = leerCache(claveExtras(maletaId))

  if (error) {
    const copia = leerCache(claveSnapshot(maletaId))
    return {
      extras: unirExtras(copia?.extras, locales),
      marcadas: unirMarcadas(copia?.marcadas, guardadas),
      sinConexion: esErrorDeRed(error),
      error: esErrorDeRed(error) ? null : 'No se pudo leer la lista de la maleta',
    }
  }

  const filas = data || []
  let marcadas = filas.filter((f) => f.prenda_id && f.hecho).map((f) => f.prenda_id)

  // Migración: las casillas que había en el móvil pasan a la base de datos.
  if (Array.isArray(guardadas) && guardadas.length > 0) {
    const nuevas = guardadas.filter((id) => !marcadas.includes(id))
    let migradas = true
    // De una en una: una prenda ya borrada (23503) no debe impedir recuperar las demás.
    for (const prenda_id of nuevas) {
      const { error: errMigrar } = await supabase.from('maleta_extras')
        .upsert([{ maleta_id: maletaId, prenda_id, hecho: true }], { onConflict: 'maleta_id,prenda_id' })
      if (!errMigrar) marcadas = [...marcadas, prenda_id]
      else if (errMigrar.code !== '23503') migradas = false
    }
    if (migradas) guardarCache(claveMarcadas(maletaId), null)
  }

  const extras = filas.filter((f) => f.texto).map(({ id, texto, hecho }) => ({ id, texto, hecho }))

  // Migración: las cosas que se añadieron cuando aún no había tabla.
  if (Array.isArray(locales) && locales.length > 0) {
    const pendientesDeMigrar = []
    for (const local of locales) {
      const texto = limpiarTexto(local?.texto)
      if (!texto || yaEsta(extras, texto)) continue
      const fila = { id: crypto.randomUUID(), maleta_id: maletaId, texto, hecho: local.hecho === true }
      const { error: errExtra } = await supabase.from('maleta_extras').insert([fila])
      if (errExtra) pendientesDeMigrar.push(local)
      else extras.push({ id: fila.id, texto, hecho: fila.hecho })
    }
    guardarCache(claveExtras(maletaId), pendientesDeMigrar.length ? pendientesDeMigrar : null)
  }

  guardarCache(claveSnapshot(maletaId), { extras, marcadas })
  return { extras, marcadas, sinConexion: false, error: null }
}

/** Guarda la copia que se enseña sin conexión (tras cada cambio). */
export function recordarChecklist(maletaId, { extras, marcadas }) {
  guardarCache(claveSnapshot(maletaId), { extras, marcadas })
}

export async function guardarMarcada(supabase, maletaId, prendaId, hecho, { escribir } = {}) {
  return ok(await via(supabase, escribir)(hecho
    ? { tabla: 'maleta_extras', accion: 'upsert', datos: { maleta_id: maletaId, prenda_id: prendaId, hecho: true }, onConflict: 'maleta_id,prenda_id' }
    : { tabla: 'maleta_extras', accion: 'delete', filtro: { maleta_id: maletaId, prenda_id: prendaId } }))
}

export async function guardarExtraHecho(supabase, maletaId, extra, { escribir } = {}) {
  return ok(await via(supabase, escribir)({ tabla: 'maleta_extras', accion: 'update', datos: { hecho: extra.hecho }, filtro: { id: extra.id } }))
}

/** Añade cosas a la lista; las que ya estaban se saltan. Devuelve las nuevas { id, texto, hecho } (o null si falla). */
export async function anadirExtras(supabase, maletaId, textos, { extras = [], escribir } = {}) {
  const nuevos = []
  for (const t of textos.map(limpiarTexto).filter(Boolean)) {
    if (!yaEsta([...extras, ...nuevos], t)) nuevos.push({ texto: t, hecho: false })
  }
  if (nuevos.length === 0) return []

  // El id lo pone la app: así la fila ya tiene identidad aunque se guarde más tarde.
  const conId = nuevos.map((n) => ({ ...n, id: crypto.randomUUID() }))
  const enviar = via(supabase, escribir)
  const guardados = []
  for (const n of conId) {
    const r = await enviar({ tabla: 'maleta_extras', accion: 'insert', datos: { id: n.id, maleta_id: maletaId, texto: n.texto } })
    if (ok(r)) guardados.push(n)
  }
  return guardados.length === 0 ? null : guardados
}

export async function quitarExtra(supabase, maletaId, extra, { escribir } = {}) {
  return ok(await via(supabase, escribir)({ tabla: 'maleta_extras', accion: 'delete', filtro: { id: extra.id } }))
}
