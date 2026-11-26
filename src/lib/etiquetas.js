// Etiquetas de una prenda (color, temporada, abrigo, formalidad, largo...).
// La lógica pura va aquí y se prueba sin navegador; las llamadas a Supabase, al final.

import { FAMILIAS_COLOR } from './colores.js'

export const TEMPORADAS = ['invierno', 'entretiempo', 'verano']
export const ESTAMPADOS = ['liso', 'rayas', 'cuadros', 'flores', 'logo', 'otro']
export const LARGOS = ['crop', 'cadera', 'corto', 'bermuda', 'tobillero', 'rodilla', 'mini', 'midi', 'maxi', 'largo']

export const NIVELES_ABRIGO = ['Tirantes', 'Ligera', 'Media', 'Abrigada', 'Muy abrigada']
export const NIVELES_FORMALIDAD = ['Deporte o casa', 'Casual', 'Arreglado', 'Elegante', 'Gala']

/** Campos que forman las etiquetas de una prenda (los de la tabla `prendas`). */
export const CAMPOS_ETIQUETA = [
  'colores', 'familia_color', 'temporada', 'abrigo', 'formalidad', 'largo', 'estampado', 'precio',
]

const vacio = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)

const sinAcentos = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

function dentroDe(valor, permitidos) {
  const buscado = sinAcentos(valor)
  return permitidos.find((p) => sinAcentos(p) === buscado) ?? null
}

function nivel(valor) {
  const n = Math.round(Number(valor))
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null
}

const esHex = (c) => /^#[0-9a-f]{6}$/i.test(String(c || ''))

/**
 * Limpia lo que devuelve la IA (o un formulario): solo valores permitidos, sin
 * campos inventados. Lo que no es válido se descarta, no se corrige a ciegas.
 */
export function normalizarEtiquetas(crudo) {
  if (!crudo || typeof crudo !== 'object') return {}
  const limpio = {}

  const temporada = [...new Set((Array.isArray(crudo.temporada) ? crudo.temporada : [crudo.temporada])
    .map((t) => dentroDe(t, TEMPORADAS)).filter(Boolean))]
  if (temporada.length) limpio.temporada = temporada

  const abrigo = nivel(crudo.abrigo)
  if (abrigo) limpio.abrigo = abrigo
  const formalidad = nivel(crudo.formalidad)
  if (formalidad) limpio.formalidad = formalidad

  const largo = dentroDe(crudo.largo, LARGOS)
  if (largo) limpio.largo = largo
  const estampado = dentroDe(crudo.estampado, ESTAMPADOS)
  if (estampado) limpio.estampado = estampado
  const familia = dentroDe(crudo.familia_color, FAMILIAS_COLOR)
  if (familia) limpio.familia_color = familia

  if (Array.isArray(crudo.colores)) {
    const colores = crudo.colores.filter(esHex).map((c) => c.toLowerCase()).slice(0, 3)
    if (colores.length) limpio.colores = colores
  }

  const precio = crudo.precio === '' || crudo.precio == null ? NaN : Number(String(crudo.precio).replace(',', '.'))
  if (Number.isFinite(precio) && precio >= 0) limpio.precio = Math.round(precio * 100) / 100

  return limpio
}

/** Lo que dice la IA sobre el nombre y la clasificación, aparte de las etiquetas. */
export function normalizarSugerencia(crudo) {
  if (!crudo || typeof crudo !== 'object') return null
  const texto = (v, max) => {
    const t = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : ''
    return t ? t.slice(0, max) : null
  }
  return {
    nombre: texto(crudo.nombre, 60),
    tipo: texto(crudo.tipo, 40),
    categoria: texto(crudo.categoria, 40),
    etiquetas: normalizarEtiquetas(crudo),
  }
}

/**
 * Qué campos de una sugerencia se pueden guardar en una prenda sin pisar nada:
 * solo los que están vacíos, y nada si ya la editaste a mano (etiquetas_auto = false).
 */
export function camposSinPisar(prenda, sugeridas) {
  if (prenda?.etiquetas_auto === false) return {}
  const nuevos = {}
  for (const campo of CAMPOS_ETIQUETA) {
    if (sugeridas[campo] === undefined) continue
    if (vacio(prenda?.[campo])) nuevos[campo] = sugeridas[campo]
  }
  return nuevos
}

/** ¿Han cambiado las etiquetas respecto a lo que había? (para marcarlas como manuales) */
export function etiquetasCambiadas(antes, despues) {
  return CAMPOS_ETIQUETA.some((campo) => {
    const a = antes?.[campo]
    const d = despues?.[campo]
    if (vacio(a) && vacio(d)) return false
    return JSON.stringify(a ?? null) !== JSON.stringify(d ?? null)
  })
}

/** Etiquetas de una prenda como valores de formulario (cadenas y listas, sin null). */
export function etiquetasDeFormulario(prenda) {
  return {
    colores: prenda?.colores || [],
    familia_color: prenda?.familia_color || '',
    temporada: prenda?.temporada || [],
    abrigo: prenda?.abrigo ?? '',
    formalidad: prenda?.formalidad ?? '',
    largo: prenda?.largo || '',
    estampado: prenda?.estampado || '',
    precio: prenda?.precio ?? '',
  }
}

/** Valores de formulario → columnas de la base de datos (vacío = null). */
export function etiquetasParaGuardar(formulario) {
  const n = normalizarEtiquetas(formulario)
  const fila = {}
  for (const campo of CAMPOS_ETIQUETA) fila[campo] = n[campo] ?? null
  return fila
}

/** ¿Alguna etiqueta tiene valor? */
export const hayEtiquetas = (etiquetas) => CAMPOS_ETIQUETA.some((c) => !vacio(etiquetas?.[c]))

// --- Llamadas a Supabase ----------------------------------------------------

const ESPERA_IA_MS = 30000

function aBase64(blob) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(String(lector.result).split(',')[1] || '')
    lector.onerror = () => reject(new Error('No se pudo leer la foto.'))
    lector.readAsDataURL(blob)
  })
}

/**
 * Pide a la función `etiquetar-prenda` que mire la foto. `ruta` (foto ya subida)
 * o `foto` (Blob aún sin subir). Devuelve la sugerencia limpia o null si la función
 * no está desplegada, falla o tarda: la app sigue funcionando sin etiquetas.
 */
export async function pedirEtiquetas(supabase, { ruta, foto } = {}) {
  try {
    const cuerpo = ruta
      ? { ruta }
      : { imagen_base64: await aBase64(foto), tipo_mime: foto.type || 'image/webp' }
    const respuesta = await Promise.race([
      supabase.functions.invoke('etiquetar-prenda', { body: cuerpo }),
      new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('espera agotada')), ESPERA_IA_MS)),
    ])
    if (respuesta.error || !respuesta.data) return null
    return normalizarSugerencia(respuesta.data)
  } catch {
    return null
  }
}

/** Guarda etiquetas de una prenda. false si la base de datos aún no tiene las columnas. */
export async function guardarEtiquetas(supabase, prendaId, campos) {
  const { error } = await supabase.from('prendas').update(campos).eq('id', prendaId)
  return !error
}

const conValores = (etiquetas) => Object.values(etiquetas).some((v) => v !== null && v !== undefined)

/**
 * Inserta una prenda con sus etiquetas. Si la base de datos aún no tiene las
 * columnas (falta ejecutar actualizacion-v4.sql), la guarda sin ellas.
 * Devuelve el error, o null si fue bien.
 */
export async function insertarPrenda(supabase, base, etiquetas) {
  let { error } = await supabase.from('prendas').insert([{ ...base, ...etiquetas }])
  if (error && conValores(etiquetas)) ({ error } = await supabase.from('prendas').insert([base]))
  return error || null
}

/** Como insertarPrenda, pero actualizando una prenda existente. */
export async function actualizarPrenda(supabase, id, base, etiquetas) {
  let { error } = await supabase.from('prendas').update({ ...base, ...etiquetas }).eq('id', id)
  if (error && conValores(etiquetas)) ({ error } = await supabase.from('prendas').update(base).eq('id', id))
  return error || null
}

/** Valor de `etiquetas_auto` al guardar: true = la IA y sin tocar, false = a mano, null = sin IA. */
export function origenEtiquetas({ sugeridaPorIA, editadas }) {
  if (editadas) return false
  return sugeridaPorIA ? true : null
}

export { sinAcentos }

/**
 * Encaja lo que dice la IA (tipo y categoría) con los tipos y categorías que ya tienes.
 * Devuelve { tipoId, categoriaId, pista }: `pista` explica lo que no ha podido encajar.
 */
export function clasificarSugerencia(sugerencia, tipos, categorias) {
  const vacio = { tipoId: '', categoriaId: '', pista: '' }
  if (!sugerencia?.tipo) return vacio
  const tipo = tipos.find((t) => sinAcentos(t.nombre) === sinAcentos(sugerencia.tipo))
  const categoria = tipo && sugerencia.categoria
    ? categorias.find((c) => c.tipo_id === tipo.id && sinAcentos(c.nombre) === sinAcentos(sugerencia.categoria))
    : null
  if (tipo && categoria) return { tipoId: tipo.id, categoriaId: categoria.id, pista: '' }
  const nombre = `${sugerencia.tipo}${sugerencia.categoria ? ` › ${sugerencia.categoria}` : ''}`
  return { tipoId: tipo?.id || '', categoriaId: '', pista: `La IA sugiere ${nombre}, que aún no existe en tus listas.` }
}
