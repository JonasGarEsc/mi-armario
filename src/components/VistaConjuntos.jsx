import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabase'
import { vibrar } from '../lib/vibrar'
import { guardarEstadoPrenda } from '../lib/estadoPrenda'
import { useChecklistMaleta } from '../lib/useChecklistMaleta'
import { leerCache, guardarCache } from '../lib/cache'
import { nombreLibre } from '../lib/nombres'
import { esperarImagenes, generarPng, generarPngDeElemento } from '../lib/exportar'
import { compartirConAviso } from '../lib/compartirUi'
import { cacheMaletas, resumenMaleta } from '../lib/maletas'
import Icono from './Icono'
import ResumenMaleta from './ResumenMaleta'
import ListaMaletas from './ListaMaletas'
import CabeceraMaleta from './CabeceraMaleta'
import ListaOutfits from './ListaOutfits'

const CONSULTA_CONJUNTOS = 'id, nombre, conjunto_prenda(*, prendas(*, categorias(nombre, tipos(nombre))))'
const CONSULTA_SIN_RANURA = 'id, nombre, conjunto_prenda(conjunto_id, prenda_id, pos_x, pos_y, z_index, prendas(*, categorias(nombre, tipos(nombre))))'

export default function VistaConjuntos({ onCrearMaleta, onPrepararMaleta, refresco = 0, recarga = 0, mostrarToast, setDialogoGlobal }) {
  const [maletas, setMaletas] = useState(() => leerCache('maletas') || [])
  const [conjuntos, setConjuntos] = useState([])
  const [cargando, setCargando] = useState(() => !leerCache('maletas'))
  const [busqueda, setBusqueda] = useState('')
  const [maletaActiva, setMaletaActiva] = useState(null)
  const [editandoNombre, setEditandoNombre] = useState(null)
  const [abriendoId, setAbriendoId] = useState(null)
  const [resumenAbierto, setResumenAbierto] = useState(false)
  const lista = useChecklistMaleta(maletaActiva?.id, refresco)
  const temporizadorMaleta = useRef(null)

  useEffect(() => () => clearTimeout(temporizadorMaleta.current), [])

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
    const anterior = lista.find(x => x.id === id)?.nombre
    if (anterior === undefined) return
    if (anterior === nombre) return

    const repetido = lista.some(x => x.id !== id && x.nombre.toLowerCase() === nombre.toLowerCase())
    if (repetido) return mostrarToast(tipo === 'maleta' ? 'Ya tienes una maleta con ese nombre' : 'Ese nombre ya existe en esta maleta', 'error')

    // Primero se pinta el nombre nuevo y luego se guarda.
    if (tipo === 'maleta') {
      const nuevas = maletas.map(m => m.id === id ? { ...m, nombre } : m)
      setMaletas(nuevas); guardarCache('maletas', cacheMaletas(nuevas))
      if (maletaActiva?.id === id) setMaletaActiva({ ...maletaActiva, nombre })
    } else {
      const nuevos = conjuntos.map(c => c.id === id ? { ...c, nombre } : c)
      setConjuntos(nuevos); guardarCache(`conjuntos_${maletaActiva.id}`, nuevos)
    }

    const { error } = await supabase.from(tipo === 'maleta' ? 'maletas' : 'conjuntos').update({ nombre }).eq('id', id)
    if (error) {
      if (tipo === 'maleta') {
        const nuevas = maletas.map(m => m.id === id ? { ...m, nombre: anterior } : m)
        setMaletas(nuevas); guardarCache('maletas', cacheMaletas(nuevas))
        if (maletaActiva?.id === id) setMaletaActiva({ ...maletaActiva, nombre: anterior })
      } else {
        const nuevos = conjuntos.map(c => c.id === id ? { ...c, nombre: anterior } : c)
        setConjuntos(nuevos); guardarCache(`conjuntos_${maletaActiva.id}`, nuevos)
      }
      return mostrarToast('No se pudo cambiar el nombre', 'error')
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
  }, [maletaActiva, refresco, recarga])

  function solicitarEliminar(tipo, id, e) {
    if (e) e.stopPropagation()
    setDialogoGlobal({
      mensaje: `¿Eliminar ${tipo}?`,
      esDestructivo: true,
      textoConfirmar: 'Eliminar',
      onConfirm: async () => {
        if (tipo === 'maleta') {
          // La base borra en cascada sus conjuntos, las prendas de estos y los extras.
          const { error } = await supabase.from('maletas').delete().eq('id', id)
          if (error) return mostrarToast('No se pudo eliminar', 'error')
          const nuevas = maletas.filter(m => m.id !== id)
          setMaletas(nuevas); guardarCache('maletas', cacheMaletas(nuevas))
          setMaletaActiva(null)
        } else {
          // La base borra en cascada las prendas del outfit.
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

  function exportarOutfit(id, nombre) {
    return compartirConAviso({
      generar: () => generarPng(id, nombre),
      nombre,
      titulo: `Outfit: ${nombre}`,
      mostrarToast,
    })
  }


  // La imagen resumen se pinta fuera de pantalla, se captura y se quita.
  const resumenListo = useCallback(async (el) => {
    const nombre = maletaActiva?.nombre || 'maleta'
    await esperarImagenes(el)
    await compartirConAviso({
      generar: () => generarPngDeElemento(el, nombre, { prefijo: 'Maleta', estilo: { position: 'static', left: '0px', top: '0px' } }),
      nombre,
      titulo: `Maleta: ${nombre}`,
      mostrarToast,
    })
    setResumenAbierto(false)
  }, [maletaActiva?.nombre, mostrarToast])

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

  async function actualizarEstado(conjuntoId, prendaId, x, y, z, ranura, extra) {
    const ok = await guardarEstadoPrenda(supabase, { conjuntoId, prendaId, x, y, z, ranura, extra })
    if (!ok) mostrarToast('No se pudo guardar la posición', 'error')
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

  const itemsFiltrados = !maletaActiva ? maletas.filter(m => m.nombre.toLowerCase().includes(busqueda.toLowerCase())) : conjuntos.filter(c => c.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  return (
    <div key={maletaActiva?.id || 'lista'} className={`flex flex-col flex-1 shrink-0 ${maletaActiva ? 'entra' : ''}`}>
      {maletaActiva ? (
        <CabeceraMaleta
          maleta={maletaActiva}
          nombreEditable={nombreEditable}
          onVolver={volver}
          resumenAbierto={resumenAbierto}
          hayConjuntos={conjuntos.length > 0}
          onCompartirResumen={() => { vibrar(20); setResumenAbierto(true) }}
          onClonar={(e) => solicitarClonar('maleta', maletaActiva, e)}
          onEliminar={(e) => solicitarEliminar('maleta', maletaActiva.id, e)}
          lista={lista}
          prendas={prendasDeLaMaleta}
          onPreparar={onPrepararMaleta}
          mostrarToast={mostrarToast}
        />
      ) : (
        <h2 className="titular max-md:sr-only shrink-0 text-3xl font-bold tracking-tight min-h-12 mb-5">Maletas</h2>
      )}

      <div className="relative mb-4 md:max-w-sm">
        <Icono nombre="buscar" className="w-5 h-5 absolute left-3.5 top-3.5 text-tenue pointer-events-none" />
        <input type="search" autoComplete="off" aria-label="Buscar" placeholder={!maletaActiva ? 'Buscar maleta' : 'Buscar outfit'} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="campo pl-11!" />
      </div>

      {maletaActiva ? (
        <ListaOutfits
          items={itemsFiltrados}
          busqueda={busqueda}
          cargando={cargando}
          nombreEditable={nombreEditable}
          onCompartir={(conj) => exportarOutfit(conj.id, conj.nombre)}
          onClonar={(conj, e) => solicitarClonar('outfit', conj, e)}
          onEliminar={(id, e) => solicitarEliminar('outfit', id, e)}
          onGuardarEstado={actualizarEstado}
        />
      ) : (
        <ListaMaletas
          items={itemsFiltrados}
          busqueda={busqueda}
          cargando={cargando}
          abriendoId={abriendoId}
          hayMaletas={maletas.length > 0}
          onEntrar={entrarMaleta}
          onCrearMaleta={onCrearMaleta}
        />
      )}

      {resumenAbierto && maletaActiva && <ResumenMaleta maleta={maletaActiva} conjuntos={conjuntos} onListo={resumenListo} />}
    </div>
  )
}
