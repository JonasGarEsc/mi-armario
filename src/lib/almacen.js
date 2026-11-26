// Un solo almacén de prendas: se carga una vez, se comparte entre vistas y se
// refresca por detrás sin remontar nada. La caché local hace que se pinte al
// instante lo que ya se tenía, incluso sin conexión.

import { useEffect, useSyncExternalStore } from 'react'
import { leerCache, guardarCache } from './cache.js'
import { CAMPOS_ETIQUETA } from './etiquetas.js'

// Lo que basta para pintar el armario y alimentar las sugerencias.
export const resumenPrenda = (p) => ({
  id: p.id,
  nombre: p.nombre,
  imagen_url: p.imagen_url,
  categoria_id: p.categoria_id,
  tipo_id: p.categorias?.tipos?.id || p.tipo_id || null,
  categorias: p.categorias
    ? { nombre: p.categorias.nombre, tipos: p.categorias.tipos ? { id: p.categorias.tipos.id, nombre: p.categorias.tipos.nombre ?? null } : null }
    : null,
  usos: Array.isArray(p.usos) ? p.usos.map(u => ({ fecha: u.fecha })) : [],
  creado_en: p.creado_en ?? null,
  etiquetas_auto: p.etiquetas_auto ?? null,
  archivada: p.archivada ?? false,
  salida: p.salida ?? null,
  deseada: p.deseada ?? false,
  ...Object.fromEntries(CAMPOS_ETIQUETA.map(c => [c, p[c] ?? null])),
})

export const CONSULTA_PRENDAS = '*, categorias(nombre, tipos(id, nombre)), usos(fecha)'

/** Carga las prendas. Devuelve null si la consulta falla. */
export async function consultarPrendas(supabase) {
  if (!supabase) return null
  const { data } = await supabase
    .from('prendas')
    .select(CONSULTA_PRENDAS)
    .order('creado_en', { ascending: false })
  return data || null
}

/**
 * Almacén mínimo con useSyncExternalStore. Se le inyectan la consulta y la
 * caché para poder probarlo sin navegador ni red.
 */
export function crearAlmacenPrendas({ consultar, leer = () => null, guardar = () => {}, resumen = resumenPrenda } = {}) {
  let estado = { prendas: [], cargando: true, cargada: false, error: null }
  const oyentes = new Set()
  // Prendas ocultas a la espera del borrado real (~7 s para deshacer). Un refresco
  // del servidor no debe devolverlas a la vista mientras sigan pendientes.
  const ocultas = new Map()
  let pedido = 0
  let revision = 0
  let enCurso = null
  let leido = false

  const emitir = () => oyentes.forEach((f) => f())
  const guardarAhora = () => {
    try {
      guardar(estado.prendas.map(resumen))
    } catch {
      // Cuota llena o modo privado: la caché es solo una mejora.
    }
  }

  function leerGuardado() {
    if (leido) return
    leido = true
    const guardadas = leer()
    if (Array.isArray(guardadas)) {
      estado = { prendas: guardadas.filter((p) => !ocultas.has(p.id)), cargando: false, cargada: false, error: null }
      emitir()
    }
  }

  async function cargar({ forzar = false } = {}) {
    leerGuardado()
    if (estado.cargada && !forzar) return estado
    if (enCurso && !forzar) return enCurso

    const miPedido = ++pedido
    const miRevision = revision
    const promesa = (async () => {
      let nuevas
      try {
        nuevas = await consultar()
      } catch {
        nuevas = undefined
      }
      // Una respuesta antigua (o anterior a un cambio local) no pisa lo nuevo.
      if (miPedido !== pedido || miRevision !== revision) return estado

      if (Array.isArray(nuevas)) {
        nuevas = nuevas.filter((p) => !ocultas.has(p.id))
        // Si nada cambió se conserva la misma lista: las propuestas en pantalla no se recalculan.
        const igual = JSON.stringify(nuevas) === JSON.stringify(estado.prendas)
        estado = { prendas: igual ? estado.prendas : nuevas, cargando: false, cargada: true, error: null }
        guardarAhora()
      } else {
        estado = { ...estado, cargando: false, error: 'No se pudieron cargar las prendas' }
      }
      emitir()
      return estado
    })()

    enCurso = promesa
    promesa.finally(() => { if (enCurso === promesa) enCurso = null })
    return promesa
  }

  /** Vacía el almacén sin red. Lo usa el cambio de cuenta: nunca ropa ajena. */
  function reiniciar() {
    pedido++
    revision++
    enCurso = null
    leido = false
    ocultas.clear()
    estado = { prendas: [], cargando: true, cargada: false, error: null }
    leerGuardado()
    emitir()
  }

  function actualizar(id, cambios) {
    revision++
    let anterior = null
    const prendas = estado.prendas.map((p) => {
      if (p.id !== id) return p
      anterior = p
      const nuevos = typeof cambios === 'function' ? cambios(p) : cambios
      return { ...p, ...nuevos }
    })
    if (!anterior) return null
    estado = { ...estado, prendas }
    guardarAhora()
    emitir()
    return anterior
  }

  function quitar(id) {
    revision++
    const anterior = estado.prendas.find((p) => p.id === id)
    if (!anterior) return null
    estado = { ...estado, prendas: estado.prendas.filter((p) => p.id !== id) }
    guardarAhora()
    emitir()
    return anterior
  }

  function reponer(prenda) {
    revision++
    if (estado.prendas.some((p) => p.id === prenda.id)) return false
    estado = { ...estado, prendas: [prenda, ...estado.prendas] }
    guardarAhora()
    emitir()
    return true
  }

  /** Esconde la prenda al instante, pero sin borrarla: aún se puede deshacer. */
  function ocultar(id) {
    revision++
    const anterior = estado.prendas.find((p) => p.id === id)
    if (!anterior || ocultas.has(id)) return null
    ocultas.set(id, anterior)
    estado = { ...estado, prendas: estado.prendas.filter((p) => p.id !== id) }
    guardarAhora()
    emitir()
    return anterior
  }

  /** Deshacer el borrado: la prenda vuelve tal cual estaba (nunca se llegó a borrar). */
  function conservar(id) {
    const prenda = ocultas.get(id)
    if (!prenda) return false
    ocultas.delete(id)
    revision++
    if (!estado.prendas.some((p) => p.id === id)) {
      estado = { ...estado, prendas: [prenda, ...estado.prendas] }
    }
    guardarAhora()
    emitir()
    return true
  }

  /** El borrado real ya fue bien: la prenda deja de estar pendiente (no vuelve). */
  function confirmarBorrado(id) {
    if (!ocultas.has(id)) return false
    ocultas.delete(id)
    return true
  }

  // Lo guardado se pinta en el primer render, antes de que llegue la red.
  leerGuardado()

  return {
    suscribir(f) { oyentes.add(f); return () => oyentes.delete(f) },
    obtener: () => estado,
    cargar,
    refrescar: () => cargar({ forzar: true }),
    revalidar: () => enCurso || cargar({ forzar: true }),
    reiniciar,
    actualizar,
    quitar,
    reponer,
    ocultar,
    conservar,
    confirmarBorrado,
  }
}

const leerLocal = () => {
  try {
    return typeof localStorage === 'undefined' ? null : leerCache('prendas')
  } catch {
    return null
  }
}
const guardarLocal = (prendas) => { if (typeof localStorage !== 'undefined') guardarCache('prendas', prendas) }

export const almacen = crearAlmacenPrendas({
  consultar: async () => {
    const { supabase } = await import('../supabase.js')
    return consultarPrendas(supabase)
  },
  leer: leerLocal,
  guardar: guardarLocal,
})

/** Prendas compartidas: { prendas, cargando, cargada, error }. */
export function usePrendas() {
  const estado = useSyncExternalStore(almacen.suscribir, almacen.obtener, almacen.obtener)
  // Cada vista que se abre enseña lo que hay y pide lo nuevo por detrás.
  useEffect(() => { almacen.revalidar() }, [])
  return estado
}

export const refrescarPrendas = () => almacen.refrescar()
export const reiniciarPrendas = () => almacen.reiniciar()
export const actualizarPrenda = (id, cambios) => almacen.actualizar(id, cambios)
export const quitarPrenda = (id) => almacen.quitar(id)
export const reponerPrenda = (prenda) => almacen.reponer(prenda)
export const ocultarPrenda = (id) => almacen.ocultar(id)
export const conservarPrenda = (id) => almacen.conservar(id)
export const confirmarBorradoPrenda = (id) => almacen.confirmarBorrado(id)
