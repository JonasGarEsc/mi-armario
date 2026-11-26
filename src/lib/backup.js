import { nombreLibre } from './nombres.js'
import { CAMPOS_ETIQUETA, normalizarEtiquetas } from './etiquetas.js'
import { intentosDeGuardado, limitarEscala } from './estadoPrenda.js'

// Restaurar una copia: se añade a lo que ya hay, sin borrar nada.
// Los ids se regeneran y las relaciones se vuelven a atar por nombre o por id
// antiguo, así que también sirve para pasar un armario a otra cuenta.

export const TABLAS_COPIA = ['tipos', 'categorias', 'maletas', 'semanas', 'prendas', 'conjuntos', 'conjunto_prenda', 'usos']

const CAMPOS_EXTRA = [...CAMPOS_ETIQUETA, 'etiquetas_auto', 'archivada', 'salida', 'deseada']

/** Fila de `prendas` a partir de una de la copia: lo básico más las etiquetas, si las trae. */
export function filaDePrenda(prenda, id, categoriaId) {
  const fila = { id, nombre: prenda.nombre, imagen_url: prenda.imagen_url, categoria_id: categoriaId }
  const etiquetas = normalizarEtiquetas(prenda) // copias antiguas: no traen nada de esto
  for (const campo of CAMPOS_ETIQUETA) if (etiquetas[campo] !== undefined) fila[campo] = etiquetas[campo]
  if (typeof prenda.etiquetas_auto === 'boolean') fila.etiquetas_auto = prenda.etiquetas_auto
  if (prenda.archivada === true) fila.archivada = true
  if (prenda.deseada === true) fila.deseada = true
  if (prenda.salida === 'donar' || prenda.salida === 'vender') fila.salida = prenda.salida
  return fila
}

const sinExtras = (fila) => Object.fromEntries(Object.entries(fila).filter(([k]) => !CAMPOS_EXTRA.includes(k)))

function enLotes(lista, tam = 200) {
  const lotes = []
  for (let i = 0; i < lista.length; i += tam) lotes.push(lista.slice(i, i + tam))
  return lotes
}

export function normalizarCopia(crudo) {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) {
    throw new Error('El archivo no parece una copia de Perletta.')
  }
  if (!Array.isArray(crudo.prendas) && !Array.isArray(crudo.conjuntos)) {
    throw new Error('La copia no tiene prendas ni outfits.')
  }
  const copia = {}
  for (const tabla of TABLAS_COPIA) copia[tabla] = Array.isArray(crudo[tabla]) ? crudo[tabla] : []
  return copia
}

export function contarCopia(crudo) {
  const copia = normalizarCopia(crudo)
  return {
    prendas: copia.prendas.length,
    conjuntos: copia.conjuntos.length,
    maletas: copia.maletas.length,
    semanas: copia.semanas.length,
  }
}

const minusculas = (texto) => String(texto || '').trim().toLowerCase()

export async function importarCopia(supabase, crudo) {
  const copia = normalizarCopia(crudo)
  const resumen = { tipos: 0, categorias: 0, maletas: 0, semanas: 0, prendas: 0, conjuntos: 0, usos: 0, omitidos: 0 }
  const nuevoId = () => crypto.randomUUID()

  // --- Tipos -------------------------------------------------------------
  const { data: tiposExistentes } = await supabase.from('tipos').select('id, nombre')
  const tiposPorNombre = new Map((tiposExistentes || []).map((t) => [minusculas(t.nombre), t.id]))
  const mapaTipos = new Map()

  for (const tipo of copia.tipos) {
    if (!tipo?.nombre) continue
    const clave = minusculas(tipo.nombre)
    if (tiposPorNombre.has(clave)) {
      if (tipo.id) mapaTipos.set(tipo.id, tiposPorNombre.get(clave))
      continue
    }
    const id = nuevoId()
    const { error } = await supabase.from('tipos').insert([{ id, nombre: tipo.nombre }])
    if (error) throw new Error(`No se pudo importar el tipo «${tipo.nombre}».`)
    tiposPorNombre.set(clave, id)
    if (tipo.id) mapaTipos.set(tipo.id, id)
    resumen.tipos++
  }

  // --- Categorías --------------------------------------------------------
  const { data: categoriasExistentes } = await supabase.from('categorias').select('id, nombre, tipo_id')
  const categoriasPorClave = new Map(
    (categoriasExistentes || []).map((c) => [`${minusculas(c.nombre)}|${c.tipo_id}`, c.id]),
  )
  const mapaCategorias = new Map()

  for (const categoria of copia.categorias) {
    if (!categoria?.nombre || !categoria.tipo_id) continue
    const tipoNuevo = mapaTipos.get(categoria.tipo_id)
    if (!tipoNuevo) {
      resumen.omitidos++
      continue
    }
    const clave = `${minusculas(categoria.nombre)}|${tipoNuevo}`
    if (categoriasPorClave.has(clave)) {
      if (categoria.id) mapaCategorias.set(categoria.id, categoriasPorClave.get(clave))
      continue
    }
    const id = nuevoId()
    const { error } = await supabase.from('categorias').insert([{ id, nombre: categoria.nombre, tipo_id: tipoNuevo }])
    if (error) throw new Error(`No se pudo importar la categoría «${categoria.nombre}».`)
    categoriasPorClave.set(clave, id)
    if (categoria.id) mapaCategorias.set(categoria.id, id)
    resumen.categorias++
  }

  // --- Maletas -----------------------------------------------------------
  const { data: maletasExistentes } = await supabase.from('maletas').select('id, nombre')
  const maletasPorNombre = new Map((maletasExistentes || []).map((m) => [minusculas(m.nombre), m.id]))
  const mapaMaletas = new Map()

  for (const maleta of copia.maletas) {
    if (!maleta?.nombre) continue
    const clave = minusculas(maleta.nombre)
    if (maletasPorNombre.has(clave)) {
      if (maleta.id) mapaMaletas.set(maleta.id, maletasPorNombre.get(clave))
      continue
    }
    const id = nuevoId()
    const fila = {
      id,
      nombre: maleta.nombre,
      destino: maleta.destino || null,
      fecha_inicio: maleta.fecha_inicio || null,
      fecha_fin: maleta.fecha_fin || null,
    }
    let { error } = await supabase.from('maletas').insert([fila])
    if (error) {
      // Copias antiguas sin las columnas de clima.
      delete fila.destino
      delete fila.fecha_inicio
      delete fila.fecha_fin
      ;({ error } = await supabase.from('maletas').insert([fila]))
    }
    if (error) throw new Error(`No se pudo importar la maleta «${maleta.nombre}».`)
    maletasPorNombre.set(clave, id)
    if (maleta.id) mapaMaletas.set(maleta.id, id)
    resumen.maletas++
  }

  // --- Semanas -----------------------------------------------------------
  const { data: semanasExistentes } = await supabase.from('semanas').select('id, fecha_inicio')
  const semanasPorFecha = new Map((semanasExistentes || []).map((s) => [s.fecha_inicio, s.id]))
  const mapaSemanas = new Map()

  for (const semana of copia.semanas) {
    if (!semana?.fecha_inicio || !semana?.fecha_fin) continue
    if (semanasPorFecha.has(semana.fecha_inicio)) {
      if (semana.id) mapaSemanas.set(semana.id, semanasPorFecha.get(semana.fecha_inicio))
      continue
    }
    const id = nuevoId()
    const { error } = await supabase.from('semanas').insert([{
      id,
      nombre: semana.nombre || semana.fecha_inicio,
      fecha_inicio: semana.fecha_inicio,
      fecha_fin: semana.fecha_fin,
    }])
    if (error) {
      resumen.omitidos++
      continue
    }
    semanasPorFecha.set(semana.fecha_inicio, id)
    if (semana.id) mapaSemanas.set(semana.id, id)
    resumen.semanas++
  }

  // --- Prendas -----------------------------------------------------------
  const mapaPrendas = new Map()
  const filasPrendas = []

  for (const prenda of copia.prendas) {
    if (!prenda?.nombre || !prenda.imagen_url) {
      resumen.omitidos++
      continue
    }
    const categoriaNueva = mapaCategorias.get(prenda.categoria_id)
    if (!categoriaNueva) {
      resumen.omitidos++
      continue
    }
    const id = nuevoId()
    filasPrendas.push(filaDePrenda(prenda, id, categoriaNueva))
    if (prenda.id) mapaPrendas.set(prenda.id, id)
  }

  for (const lote of enLotes(filasPrendas)) {
    let { error } = await supabase.from('prendas').insert(lote)
    // Base de datos sin actualizacion-v4.sql: las prendas entran sin etiquetas.
    if (error && lote.some((f) => CAMPOS_EXTRA.some((c) => c in f))) {
      ({ error } = await supabase.from('prendas').insert(lote.map(sinExtras)))
    }
    if (error) throw new Error('No se pudieron importar algunas prendas.')
    resumen.prendas += lote.length
  }

  // --- Conjuntos ---------------------------------------------------------
  const { data: conjuntosExistentes } = await supabase
    .from('conjuntos')
    .select('id, nombre, maleta_id, semana_id, fecha')
  const nombresPorContenedor = new Map()
  const claveContenedor = (maletaId, semanaId, fecha) =>
    maletaId ? `m:${maletaId}` : `s:${semanaId}:${fecha}`

  for (const c of conjuntosExistentes || []) {
    const clave = claveContenedor(c.maleta_id, c.semana_id, c.fecha)
    if (!nombresPorContenedor.has(clave)) nombresPorContenedor.set(clave, [])
    nombresPorContenedor.get(clave).push(c.nombre)
  }

  const cpPorConjunto = new Map()
  for (const cp of copia.conjunto_prenda) {
    if (!cp?.conjunto_id) continue
    if (!cpPorConjunto.has(cp.conjunto_id)) cpPorConjunto.set(cp.conjunto_id, [])
    cpPorConjunto.get(cp.conjunto_id).push(cp)
  }
  for (const conjunto of copia.conjuntos) {
    if (!conjunto?.id || !Array.isArray(conjunto.conjunto_prenda)) continue
    cpPorConjunto.set(conjunto.id, conjunto.conjunto_prenda)
  }

  for (const conjunto of copia.conjuntos) {
    if (!conjunto?.nombre) {
      resumen.omitidos++
      continue
    }
    const maletaNueva = conjunto.maleta_id ? mapaMaletas.get(conjunto.maleta_id) : null
    const semanaNueva = conjunto.semana_id ? mapaSemanas.get(conjunto.semana_id) : null
    const fecha = conjunto.fecha || null

    if (!maletaNueva && !(semanaNueva && fecha)) {
      resumen.omitidos++
      continue
    }

    const clave = claveContenedor(maletaNueva, semanaNueva, fecha)
    const nombres = nombresPorContenedor.get(clave) || []
    const nombre = nombreLibre(conjunto.nombre, nombres)

    const vistos = new Set()
    const prendasDelConjunto = (cpPorConjunto.get(conjunto.id) || [])
      .map((cp) => {
        const prendaNueva = mapaPrendas.get(cp.prenda_id)
        if (!prendaNueva || vistos.has(prendaNueva)) return null
        vistos.add(prendaNueva)
        const fila = {
          prenda_id: prendaNueva,
          pos_x: cp.pos_x ?? 40,
          pos_y: cp.pos_y ?? 20,
          z_index: cp.z_index ?? 1,
        }
        if (cp.ranura) fila.ranura = cp.ranura
        // Copias antiguas: sin escala ni «por dentro».
        if (typeof cp.escala === 'number' && cp.escala !== 1) fila.escala = limitarEscala(cp.escala)
        if (cp.por_dentro === true) fila.por_dentro = true
        return fila
      })
      .filter(Boolean)

    if (prendasDelConjunto.length === 0) {
      resumen.omitidos++
      continue
    }

    const fila = {
      id: nuevoId(),
      nombre,
      maleta_id: maletaNueva || null,
      semana_id: semanaNueva || null,
      fecha: semanaNueva ? fecha : null,
      conjunto_prenda: prendasDelConjunto,
    }

    // Base de datos sin las columnas nuevas o sin `ranura`: se guarda igual, con menos detalle.
    let error = null
    const variantes = prendasDelConjunto.map((cp) => intentosDeGuardado(cp))
    const pasos = Math.max(...variantes.map((v) => v.length))
    for (let paso = 0; paso < pasos; paso++) {
      fila.conjunto_prenda = variantes.map((v) => v[Math.min(paso, v.length - 1)])
      ;({ error } = await supabase.from('conjuntos').insert([fila]))
      if (!error) break
    }
    if (error) {
      resumen.omitidos++
      continue
    }

    nombres.push(nombre)
    nombresPorContenedor.set(clave, nombres)
    resumen.conjuntos++
  }

  // --- Usos --------------------------------------------------------------
  const filasUsos = copia.usos
    .map((uso) => {
      const prendaNueva = mapaPrendas.get(uso?.prenda_id)
      if (!prendaNueva) return null
      return { prenda_id: prendaNueva, fecha: uso.fecha || null }
    })
    .filter(Boolean)

  for (const lote of enLotes(filasUsos)) {
    const filas = lote.map((fila) => (fila.fecha ? fila : { prenda_id: fila.prenda_id }))
    const { error } = await supabase.from('usos').insert(filas)
    if (!error) resumen.usos += filas.length
  }

  return resumen
}
