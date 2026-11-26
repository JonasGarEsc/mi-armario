import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { vibrar } from '../lib/vibrar'
import { leerCache, guardarCache } from '../lib/cache'
import { desdeISO, etiquetaFechaCorta, isoLocal } from '../lib/fechas'
import { nombreLibre } from '../lib/nombres'
import { compartirArchivo, descargar, generarPng } from '../lib/exportar'
import Icono from './Icono'
import Miniatura from './Miniatura'
import LienzoOutfit from './LienzoOutfit'

const CONSULTA_CONJUNTOS = 'id, nombre, conjunto_prenda(conjunto_id, prenda_id, pos_x, pos_y, z_index, ranura, prendas(*, categorias(nombre, tipos(nombre))))'
const CONSULTA_SIN_RANURA = 'id, nombre, conjunto_prenda(conjunto_id, prenda_id, pos_x, pos_y, z_index, prendas(*, categorias(nombre, tipos(nombre))))'

function resumenMaleta(maleta) {
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

const cacheMaletas = (lista) => lista.map((m) => (Array.isArray(m.conjuntos) ? resumenMaleta(m) : m))

function WidgetClima({ maleta }) {
  const [clima, setClima] = useState(null)
  const [cargando, setCargando] = useState(true)
  const destino = (maleta?.destino || maleta?.nombre || '').replace(/[0-9]/g, '').trim()
  const inicio = maleta?.fecha_inicio
  const fin = maleta?.fecha_fin

  useEffect(() => {
    let montado = true

    async function obtenerClima() {
      setCargando(true)
      setClima(null)
      if (!destino || destino.length < 3) {
        setCargando(false)
        return
      }

      const hoy = new Date()
      const tope = new Date()
      tope.setDate(tope.getDate() + 15)

      let desde = hoy
      let hasta = hoy
      if (inicio) {
        desde = desdeISO(inicio)
        hasta = fin ? desdeISO(fin) : desde
        if (desde > tope) {
          if (montado) {
            setClima({ futuro: true })
            setCargando(false)
          }
          return
        }
        if (hasta > tope) hasta = tope
      }

      try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destino)}&count=1&language=es&format=json`)
        const geoData = await geoRes.json()
        if (!geoData.results?.length) return

        const { latitude, longitude, name } = geoData.results[0]
        const params = new URLSearchParams({
          latitude,
          longitude,
          daily: 'temperature_2m_max,temperature_2m_min',
          timezone: 'auto',
          start_date: isoLocal(desde),
          end_date: isoLocal(hasta),
        })
        const tiempoRes = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
        const tiempo = await tiempoRes.json()
        if (!tiempo.daily?.time?.length) return

        const i = Math.max(0, tiempo.daily.time.indexOf(isoLocal(desde)))
        if (montado) {
          setClima({
            nombre: name,
            fecha: tiempo.daily.time[i],
            max: tiempo.daily.temperature_2m_max[i],
            min: tiempo.daily.temperature_2m_min[i],
          })
        }
      } catch {
        // Sin previsión no pasa nada: la línea se queda vacía.
      }
      if (montado) setCargando(false)
    }

    obtenerClima()
    return () => { montado = false }
  }, [destino, inicio, fin])

  // La línea mide lo mismo cargando, sin dato y con dato: nada salta al llegar el clima.
  return (
    <div className="h-6 flex items-center text-sm text-tenue">
      {cargando ? (
        <div className="esqueleto h-3 w-40" />
      ) : clima?.futuro ? (
        <p className="truncate">La previsión llegará más cerca de la fecha.</p>
      ) : clima ? (
        <p className="truncate">
          {clima.nombre}: {etiquetaFechaCorta(clima.fecha)} · máx {Math.round(clima.max)}°, mín {Math.round(clima.min)}°
        </p>
      ) : null}
    </div>
  )
}

export default function VistaConjuntos({ onCrearMaleta, mostrarToast, setDialogoGlobal }) {
  const [maletas, setMaletas] = useState(() => leerCache('maletas') || [])
  const [conjuntos, setConjuntos] = useState([])
  const [cargando, setCargando] = useState(() => !leerCache('maletas'))
  const [busqueda, setBusqueda] = useState('')
  const [maletaActiva, setMaletaActiva] = useState(null)
  const [editandoNombre, setEditandoNombre] = useState(null)
  const [abriendoId, setAbriendoId] = useState(null)
  const [checklistAbierta, setChecklistAbierta] = useState(false)
  const [marcadas, setMarcadas] = useState([])
  const temporizadorMaleta = useRef(null)

  useEffect(() => () => clearTimeout(temporizadorMaleta.current), [])

  useEffect(() => {
    if (!maletaActiva) {
      setMarcadas([])
      setChecklistAbierta(false)
      return
    }
    const guardadas = leerCache(`checklist_${maletaActiva.id}`)
    setMarcadas(Array.isArray(guardadas) ? guardadas : [])
    setChecklistAbierta(false)
  }, [maletaActiva])

  // La tapa se abre y, al terminar el giro, se entra. Con movimiento reducido, directo.
  function entrarMaleta(m) {
    if (abriendoId) return
    vibrar(20)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      abrirMaleta(m)
      return
    }
    setAbriendoId(m.id)
    temporizadorMaleta.current = setTimeout(() => {
      setAbriendoId(null)
      abrirMaleta(m)
    }, 520)
  }

  async function guardarNombre() {
    if (!editandoNombre) return
    const { tipo, id, valor } = editandoNombre
    setEditandoNombre(null)
    const nombre = valor.trim()
    if (!nombre) return
    const lista = tipo === 'maleta' ? maletas : conjuntos
    if (lista.find(x => x.id === id)?.nombre === nombre) return

    const repetido = lista.some(x => x.id !== id && x.nombre.toLowerCase() === nombre.toLowerCase())
    if (repetido) return mostrarToast(tipo === 'maleta' ? 'Ya tienes una maleta con ese nombre' : 'Ese nombre ya existe en esta maleta', 'error')

    const { error } = await supabase.from(tipo === 'maleta' ? 'maletas' : 'conjuntos').update({ nombre }).eq('id', id)
    if (error) return mostrarToast('No se pudo cambiar el nombre', 'error')

    if (tipo === 'maleta') {
      const nuevas = maletas.map(m => m.id === id ? { ...m, nombre } : m)
      setMaletas(nuevas); guardarCache('maletas', cacheMaletas(nuevas))
      if (maletaActiva?.id === id) setMaletaActiva({ ...maletaActiva, nombre })
    } else {
      const nuevos = conjuntos.map(c => c.id === id ? { ...c, nombre } : c)
      setConjuntos(nuevos); guardarCache(`conjuntos_${maletaActiva.id}`, nuevos)
    }
    mostrarToast('Nombre cambiado', 'exito')
  }

  // Tocar el nombre lo convierte en campo de texto. Enter o salir del campo guarda.
  function nombreEditable(tipo, id, nombre, clases) {
    if (editandoNombre?.tipo === tipo && editandoNombre.id === id) {
      return (
        <input
          value={editandoNombre.valor}
          autoFocus
          aria-label="Nuevo nombre"
          onChange={e => setEditandoNombre({ ...editandoNombre, valor: e.target.value })}
          onBlur={guardarNombre}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
            if (e.key === 'Escape') setEditandoNombre(null)
          }}
          className={`${clases} w-full min-w-0 bg-transparent border-b-2 border-acento`}
        />
      )
    }
    return (
      <button onClick={(e) => { e.stopPropagation(); setEditandoNombre({ tipo, id, valor: nombre }) }} title="Cambiar nombre" className={`${clases} truncate text-left`}>
        {nombre}
      </button>
    )
  }

  useEffect(() => {
    async function cargarDatos() {
      if (!maletaActiva) {
        const cache = leerCache('maletas')
        if (cache) { setMaletas(cache); setCargando(false); }
        const { data } = await supabase.from('maletas').select('*, conjuntos(id, conjunto_prenda(prendas(imagen_url)))').order('nombre')
        if (data) {
          setMaletas(data)
          guardarCache('maletas', data.map(resumenMaleta))
        }
      } else {
        const clave = `conjuntos_${maletaActiva.id}`
        const cache = leerCache(clave)
        if (cache) { setConjuntos(cache); setCargando(false); }
        let { data } = await supabase.from('conjuntos').select(CONSULTA_CONJUNTOS).eq('maleta_id', maletaActiva.id).order('nombre')
        if (!data) {
          // Base de datos sin la columna ranura: se carga igual, sin imantación.
          ;({ data } = await supabase.from('conjuntos').select(CONSULTA_SIN_RANURA).eq('maleta_id', maletaActiva.id).order('nombre'))
        }
        if (data) { setConjuntos(data); guardarCache(clave, data); }
      }
      setCargando(false)
    }
    cargarDatos()
  }, [maletaActiva])

  function solicitarEliminar(tipo, id, e) {
    if (e) e.stopPropagation()
    setDialogoGlobal({
      mensaje: `¿Eliminar ${tipo}?`,
      esDestructivo: true,
      textoConfirmar: 'Eliminar',
      onConfirm: async () => {
        if (tipo === 'maleta') {
          const { data: suyos } = await supabase.from('conjuntos').select('id').eq('maleta_id', id)
          const ids = (suyos || []).map(c => c.id)
          if (ids.length > 0) await supabase.from('conjunto_prenda').delete().in('conjunto_id', ids)
          await supabase.from('conjuntos').delete().eq('maleta_id', id)
          const { error } = await supabase.from('maletas').delete().eq('id', id)
          if (error) return mostrarToast('No se pudo eliminar', 'error')
          const nuevas = maletas.filter(m => m.id !== id)
          setMaletas(nuevas); guardarCache('maletas', cacheMaletas(nuevas))
          setMaletaActiva(null)
        } else {
          await supabase.from('conjunto_prenda').delete().eq('conjunto_id', id)
          const { error } = await supabase.from('conjuntos').delete().eq('id', id)
          if (error) return mostrarToast('No se pudo eliminar', 'error')
          const nuevos = conjuntos.filter(c => c.id !== id)
          setConjuntos(nuevos); guardarCache(`conjuntos_${maletaActiva.id}`, nuevos)
        }
        vibrar([50, 50])
        mostrarToast("Eliminado correctamente", "info")
      }
    })
  }

  function solicitarClonar(tipo, item, e) {
    if (e) e.stopPropagation()
    
    // Almacenamos valores temporales para los inputs
    let idMaletaDestino = maletaActiva?.id || (maletas.length > 0 ? maletas[0].id : '')
    let nuevoNombre = `${item.nombre} (Copia)`

    setDialogoGlobal({
      mensaje: `Duplicar ${tipo === 'outfit' ? 'Outfit' : 'Maleta'}`,
      esDestructivo: false,
      textoConfirmar: 'Clonar',
      contenidoAdicional: (
        <div className="flex flex-col gap-4 text-left mb-4">
          {tipo === 'outfit' && (
            <div>
              <label htmlFor="clonDestino" className="etiqueta">Destino:</label>
              <select id="clonDestino" onChange={(e) => idMaletaDestino = e.target.value} defaultValue={idMaletaDestino} className="campo">
                {maletas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="clonNombre" className="etiqueta">Nuevo nombre:</label>
            <input id="clonNombre" type="text" autoComplete="off" onChange={(e) => nuevoNombre = e.target.value} defaultValue={nuevoNombre} className="campo" />
          </div>
        </div>
      ),
      onConfirm: async () => {
        if (tipo === 'outfit') {
          const { data: nombresDestino } = await supabase.from('conjuntos').select('nombre').eq('maleta_id', idMaletaDestino)
          const nombreFinal = nombreLibre(nuevoNombre, (nombresDestino || []).map(n => n.nombre))
          // Una sola llamada con las relaciones anidadas.
          const { error } = await supabase.from('conjuntos').insert([{
            nombre: nombreFinal,
            maleta_id: idMaletaDestino,
            conjunto_prenda: item.conjunto_prenda.map(cp => ({
              prenda_id: cp.prenda_id, pos_x: cp.pos_x, pos_y: cp.pos_y, z_index: cp.z_index, ranura: cp.ranura || null
            }))
          }])
          if (error) return mostrarToast("Error al clonar.", "error")
          if (idMaletaDestino == maletaActiva?.id) setMaletaActiva({...maletaActiva}) 
          mostrarToast("Outfit clonado", "exito")
        } else {
          const nombreFinal = nombreLibre(nuevoNombre, maletas.map(m => m.nombre))
          let { data: nuevaMaleta, error: errM } = await supabase.from('maletas').insert([{
            nombre: nombreFinal,
            destino: item.destino || null,
            fecha_inicio: item.fecha_inicio || null,
            fecha_fin: item.fecha_fin || null,
          }]).select().single()

          if (errM) {
            // Base de datos sin las columnas de clima: la maleta se clona igual.
            ;({ data: nuevaMaleta, error: errM } = await supabase
              .from('maletas')
              .insert([{ nombre: nombreFinal }])
              .select()
              .single())
          }
          if (errM || !nuevaMaleta) return mostrarToast("Error al clonar maleta.", "error")
          const { data: conjuntosViejos } = await supabase.from('conjuntos').select('id, nombre, conjunto_prenda(prenda_id, pos_x, pos_y, z_index, ranura)').eq('maleta_id', item.id)
          if (conjuntosViejos?.length) {
            const { error: errC } = await supabase.from('conjuntos').insert(conjuntosViejos.map(c => ({
              nombre: c.nombre,
              maleta_id: nuevaMaleta.id,
              conjunto_prenda: (c.conjunto_prenda || []).map(cp => ({
                prenda_id: cp.prenda_id, pos_x: cp.pos_x, pos_y: cp.pos_y, z_index: cp.z_index, ranura: cp.ranura || null
              }))
            })))
            if (errC) return mostrarToast("Error al clonar los outfits", "error")
          }
          const { data: listaMaletas } = await supabase.from('maletas').select('*, conjuntos(id, conjunto_prenda(prendas(imagen_url)))').order('nombre')
          if (listaMaletas) { setMaletas(listaMaletas); guardarCache('maletas', listaMaletas.map(resumenMaleta)) }
          setMaletaActiva(null)
          mostrarToast("Maleta clonada", "exito")
        }
        vibrar([50, 50])
      }
    })
  }

  async function exportarOutfit(id, nombre) {
    vibrar(30)
    try {
      const { dataUrl, file } = await generarPng(id, nombre)
      descargar(dataUrl, nombre)
      const puedeCompartir = navigator.canShare?.({ files: [file] })
      mostrarToast('Imagen descargada', 'exito', puedeCompartir
        ? {
            texto: 'Compartir',
            onClick: () => compartirArchivo(file, nombre)
              .catch(() => mostrarToast('No se pudo compartir', 'error')),
          }
        : null)
      vibrar([30, 30])
    } catch {
      mostrarToast("Error al exportar", "error")
    }
  }

  function abrirMaleta(maleta) {
    const cache = leerCache(`conjuntos_${maleta.id}`)
    setConjuntos(cache || [])
    setCargando(!cache)
    setBusqueda('')
    setMaletaActiva(maleta)
  }

  function volver() {
    vibrar(20)
    setBusqueda('')
    setCargando(false)
    setMaletaActiva(null)
  }

  async function actualizarEstado(conjuntoId, prendaId, x, y, z, ranura) {
    const fila = { pos_x: x, pos_y: y, z_index: z }
    if (ranura !== undefined) fila.ranura = ranura

    let { error } = await supabase
      .from('conjunto_prenda')
      .update(fila)
      .match({ conjunto_id: conjuntoId, prenda_id: prendaId })

    if (error && 'ranura' in fila) {
      // Base de datos sin la columna ranura: se guarda la posición igual.
      delete fila.ranura
      ;({ error } = await supabase
        .from('conjunto_prenda')
        .update(fila)
        .match({ conjunto_id: conjuntoId, prenda_id: prendaId }))
    }
    if (error) mostrarToast('No se pudo guardar la posición', 'error')
  }

  const extraerImagenesMaleta = (maleta) => {
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

  const prendasDeLaMaleta = (() => {
    const unicas = new Map()
    conjuntos.forEach(c => {
      ;(c.conjunto_prenda || []).forEach(cp => {
        if (cp.prendas && !unicas.has(cp.prenda_id)) unicas.set(cp.prenda_id, cp.prendas)
      })
    })
    return [...unicas.values()]
  })()

  const hechas = marcadas.filter(id => prendasDeLaMaleta.some(p => p.id === id)).length

  function alternarChecklist(id) {
    if (!maletaActiva) return
    const nuevas = marcadas.includes(id) ? marcadas.filter(x => x !== id) : [...marcadas, id]
    setMarcadas(nuevas)
    guardarCache(`checklist_${maletaActiva.id}`, nuevas)
    vibrar(8)
  }

  const itemsFiltrados = !maletaActiva ? maletas.filter(m => m.nombre.toLowerCase().includes(busqueda.toLowerCase())) : conjuntos.filter(c => c.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  return (
    <div key={maletaActiva?.id || 'lista'} className={`flex flex-col flex-1 shrink-0 ${maletaActiva ? 'entra' : ''}`}>
      {maletaActiva ? (
        <div className="mb-3">
          <div className="flex items-center gap-1 min-h-12">
            <button onClick={volver} aria-label="Volver a las maletas" className="boton-icono -ml-3">
              <Icono nombre="volver" />
            </button>
            <h2 className="flex-1 min-w-0 flex">
              {nombreEditable('maleta', maletaActiva.id, maletaActiva.nombre, 'min-h-11 max-w-full text-2xl md:text-3xl font-bold tracking-tight')}
            </h2>
            <button onClick={(e) => solicitarClonar('maleta', maletaActiva, e)} aria-label={`Duplicar ${maletaActiva.nombre}`} className="boton-icono">
              <Icono nombre="duplicar" />
            </button>
            <button onClick={(e) => solicitarEliminar('maleta', maletaActiva.id, e)} aria-label={`Eliminar ${maletaActiva.nombre}`} className="boton-icono -mr-2">
              <Icono nombre="borrar" />
            </button>
          </div>
          <WidgetClima maleta={maletaActiva} />

          {prendasDeLaMaleta.length > 0 && (
            <div className="mt-1">
              <button
                onClick={() => setChecklistAbierta(!checklistAbierta)}
                aria-expanded={checklistAbierta}
                className="min-h-9 flex items-center gap-2 text-sm font-semibold text-acento"
              >
                <Icono nombre="lista" className="w-4 h-4" />
                Lista de la maleta · {hechas}/{prendasDeLaMaleta.length}
              </button>

              {checklistAbierta && (
                <ul className="mt-2 rounded-xl border border-linea divide-y divide-linea overflow-hidden">
                  {prendasDeLaMaleta.map(prenda => {
                    const hecha = marcadas.includes(prenda.id)
                    return (
                      <li key={prenda.id}>
                        <label className="flex items-center gap-3 px-3 py-2 min-h-11 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={hecha}
                            onChange={() => alternarChecklist(prenda.id)}
                            className="w-5 h-5 shrink-0 accent-acento"
                          />
                          <span className={`flex-1 min-w-0 truncate text-sm ${hecha ? 'line-through text-tenue' : ''}`}>{prenda.nombre}</span>
                          <span className="w-8 h-8 shrink-0 rounded bg-foto p-0.5">
                            <Miniatura url={prenda.imagen_url} alt="" className="w-full h-full object-contain" />
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      ) : (
        <h2 className="max-md:sr-only shrink-0 text-3xl font-bold tracking-tight min-h-12 mb-5">Maletas</h2>
      )}

      <div className="relative mb-4 md:max-w-sm">
        <Icono nombre="buscar" className="w-5 h-5 absolute left-3.5 top-3.5 text-tenue pointer-events-none" />
        <input type="search" autoComplete="off" aria-label="Buscar" placeholder={!maletaActiva ? 'Buscar maleta' : 'Buscar outfit'} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="campo pl-11!" />
      </div>

      {cargando ? (
        <div role="status" aria-label="Cargando" className={maletaActiva ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5' : 'rejilla'}>
          {maletaActiva
            ? <div className="esqueleto h-114 md:h-139" />
            : [0, 1].map(i => <div key={i}><div className="esqueleto aspect-[2/3] w-[86%] max-w-52 mx-auto mt-8 mb-3" /><div className="h-12 mt-2 flex flex-col items-center justify-center gap-2"><div className="esqueleto h-3 w-2/3" /><div className="esqueleto h-3 w-1/3" /></div></div>)}
        </div>
      ) : itemsFiltrados.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-center">
          <Icono nombre="maleta" className="w-12 h-12 text-tenue" />
          <p className="text-xl font-bold">{busqueda ? 'Nada coincide con la búsqueda' : maletaActiva ? 'Esta maleta está vacía' : 'Todavía no hay maletas'}</p>
          {!busqueda && <p className="text-tenue max-w-xs">{maletaActiva ? 'Elige prendas en el armario y crea un outfit para esta maleta.' : 'Crea una, elige prendas del armario y monta los outfits dentro.'}</p>}
          {!busqueda && !maletaActiva && <button onClick={onCrearMaleta} className="boton boton-primario mt-2">Nueva maleta</button>}
        </div>
      ) : !maletaActiva ? (
        <div className="rejilla mb-4">
          {itemsFiltrados.map((m) => {
            const { imagenes, total } = extraerImagenesMaleta(m)
            const columnas = imagenes.length > 2 ? 2 : 1
            const filas = Math.ceil(imagenes.length / columnas)
            // Cada pieza es mayor que su hueco: así se pisan como ropa doblada.
            // De cinco en adelante, filas ordenadas: solape leve y casi sin giro.
            const llena = imagenes.length > 4
            const ancho = columnas === 1 ? 100 : llena ? 52 : 62
            const alto = filas === 1 ? 100 : 100 / filas + (llena ? 3 : 14)
            const outfits = m.outfits ?? (m.conjuntos?.length || 0)
            const abierta = abriendoId === m.id
            return (
              <button key={m.id} onClick={() => entrarMaleta(m)} aria-label={`Abrir ${m.nombre}`} className="min-w-0 self-start text-center rounded-xl">
                <span className={`maleta relative w-[86%] max-w-52 mx-auto pt-8 pb-3 ${abierta ? 'abierta' : ''}`}>
                  <span className="maleta-suelo absolute -inset-x-3 -bottom-0.5 h-5" aria-hidden="true" />
                  {/* Asa telescópica, patas y ruedas: van en la carcasa trasera, no se mueven con la tapa. */}
                  <span className="absolute left-1/2 -translate-x-1/2 top-1 w-[46%] h-8" aria-hidden="true">
                    <span className="maleta-barra absolute left-2 top-2 bottom-0 w-1.5" />
                    <span className="maleta-barra absolute right-2 top-2 bottom-0 w-1.5" />
                    <span className="maleta-goma absolute left-1 bottom-0 w-3.5 h-1.5 rounded-t-sm" />
                    <span className="maleta-goma absolute right-1 bottom-0 w-3.5 h-1.5 rounded-t-sm" />
                    <span className="maleta-goma absolute inset-x-0 top-0 h-3.5 rounded-full" />
                    <span className="maleta-metal absolute left-1/2 -translate-x-1/2 top-1 w-5 h-1.5 rounded-full" />
                  </span>
                  {['left-[11%]', 'right-[11%]'].map(lado => (
                    <span key={lado} className={`absolute ${lado} bottom-0 w-6 h-4`} aria-hidden="true">
                      <span className="maleta-goma absolute inset-x-1 top-0 h-2 rounded-b-sm" />
                      <span className="maleta-rueda absolute left-0.5 bottom-0 w-2.5 h-2.5 rounded-full" />
                      <span className="maleta-rueda absolute right-0.5 bottom-0 w-2.5 h-2.5 rounded-full" />
                    </span>
                  ))}

                  <span className="maleta-cuerpo relative block aspect-[2/3]">
                    {/* Asa lateral con su etiqueta de cuero. */}
                    <span className="maleta-goma absolute -right-1 top-[24%] w-2 h-[16%] rounded-r-[4px]" aria-hidden="true" />
                    <span className="maleta-etiqueta absolute -right-2 top-[38%] w-3 h-[11%] rounded-[2px]" aria-hidden="true" />

                    {/* Carcasa trasera y forro: la ropa doblada se ve al abrir la tapa. */}
                    <span className="maleta-carcasa absolute inset-0 rounded-[14px] p-[5%]">
                      <span className="maleta-interior relative block w-full h-full rounded-[9px] overflow-hidden">
                        {imagenes.length === 0 && (
                          <>
                            <span className="maleta-correa absolute -inset-x-4 top-1/2 h-3 -translate-y-1/2 rotate-[52deg]" />
                            <span className="maleta-correa absolute -inset-x-4 top-1/2 h-3 -translate-y-1/2 -rotate-[52deg]" />
                            <span className="maleta-metal absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-5 rounded" />
                          </>
                        )}
                        <span className="absolute inset-1.5">
                          {imagenes.map((url, i) => {
                            const fila = Math.floor(i / columnas)
                            // Si la última fila queda coja, la prenda suelta va centrada.
                            const suelta = columnas === 2 && i === imagenes.length - 1 && i % 2 === 0
                            return (
                              <span key={url} className="maleta-prenda absolute" style={{
                                left: `${suelta ? (100 - ancho) / 2 : (i % columnas) * (100 - ancho)}%`,
                                top: `${filas > 1 ? fila * (100 - alto) / (filas - 1) : 0}%`,
                                width: `${ancho}%`,
                                height: `${alto}%`,
                                '--giro': `${llena ? (i % 2 ? 1 : -1) : [-2, 1.5, 2.5, -1.5][i]}deg`,
                                '--retardo': `${120 + fila * 50}ms`,
                              }}>
                                <Miniatura url={url} alt="" className="w-full h-full object-contain" />
                              </span>
                            )
                          })}
                        </span>
                      </span>
                    </span>

                    {/* Tapa con bisagra a la izquierda: cara exterior y forro por detrás. */}
                    <span className="maleta-tapa absolute inset-0" aria-hidden="true">
                      <span className="maleta-reverso absolute inset-0 rounded-[14px]">
                        <span className="maleta-bolsillo absolute inset-x-3 bottom-3 h-[46%] rounded-lg" />
                      </span>
                      <span className="maleta-cara maleta-carcasa absolute inset-0 rounded-[14px] overflow-hidden">
                        {/* Acanalado del aluminio y junta del perímetro. */}
                        <span className="maleta-costillas absolute inset-x-[8%] inset-y-[5%]" />
                        <span className="maleta-junta absolute inset-[3.5%] rounded-[11px]" />
                        {/* Cierre con candado, encastrado en el borde que se abre. */}
                        <span className="maleta-cierre absolute right-[5%] top-[44%] w-[11%] h-[12%] rounded-[3px]">
                          <span className="maleta-metal absolute inset-x-[22%] top-[18%] h-[26%] rounded-[2px]" />
                          <span className="maleta-ruedecillas absolute inset-x-[22%] bottom-[16%] h-[30%] rounded-[1px]" />
                        </span>
                      </span>
                    </span>

                    {/* Bisagras sobre el eje de giro. */}
                    <span className="maleta-bisagra absolute -left-[3px] top-[15%] w-[5px] h-[9%] rounded-[2px]" aria-hidden="true" />
                    <span className="maleta-bisagra absolute -left-[3px] bottom-[15%] w-[5px] h-[9%] rounded-[2px]" aria-hidden="true" />
                  </span>
                </span>
                <span className="block mt-2 font-semibold leading-6 truncate">{m.nombre}</span>
                <span className="block text-sm leading-6 text-tenue truncate">{outfits === 1 ? '1 outfit' : `${outfits} outfits`}{total > 0 && `, ${total === 1 ? '1 prenda' : `${total} prendas`}`}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-4">
          {itemsFiltrados.map((conj) => (
            <article key={conj.id} className="min-w-0 rounded-xl border border-linea bg-superficie overflow-hidden isolate">
              <div className="flex items-center pl-4 pr-1 h-14 border-b border-linea">
                <h3 className="flex-1 min-w-0 flex">
                  {nombreEditable('outfit', conj.id, conj.nombre, 'min-h-11 max-w-full text-lg font-semibold')}
                </h3>
                <button onClick={() => exportarOutfit(conj.id, conj.nombre)} aria-label={`Descargar imagen de ${conj.nombre}`} className="boton-icono">
                  <Icono nombre="descargar" className="w-5 h-5" />
                </button>
                <button onClick={(e) => solicitarClonar('outfit', conj, e)} aria-label={`Duplicar ${conj.nombre}`} className="boton-icono">
                  <Icono nombre="duplicar" className="w-5 h-5" />
                </button>
                <button onClick={(e) => solicitarEliminar('outfit', conj.id, e)} aria-label={`Eliminar ${conj.nombre}`} className="boton-icono">
                  <Icono nombre="borrar" className="w-5 h-5" />
                </button>
              </div>

              <LienzoOutfit conjunto={conj} onGuardarEstado={actualizarEstado} />
            </article>
          ))}
        </div>
      )}

      {!maletaActiva && !cargando && maletas.length > 0 && (
        <button onClick={onCrearMaleta} className="accion boton boton-primario">
          <Icono nombre="mas" className="w-5 h-5" />
          Nueva maleta
        </button>
      )}
    </div>
  )
}