import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { vibrar } from '../App'
import { toPng } from 'html-to-image'
import { leerCache, guardarCache } from '../lib/cache'
import { limitarPosicion } from '../lib/outfits'
import Icono from './Icono'
import Miniatura from './Miniatura'

function WidgetClima({ destino }) {
  const [clima, setClima] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let montado = true
    async function obtenerClima() {
      setCargando(true)
      const ciudadPura = destino.replace(/[0-9]/g, '').trim()
      if (!ciudadPura || ciudadPura.length < 3) {
        if(montado) setCargando(false)
        return
      }
      try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ciudadPura)}&count=1&language=es&format=json`)
        const geoData = await geoRes.json()
        if (geoData.results?.length > 0) {
          const { latitude, longitude, name } = geoData.results[0]
          const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=1`)
          const weatherData = await weatherRes.json()
          if (montado) setClima({ nombre: name, max: weatherData.daily.temperature_2m_max[0], min: weatherData.daily.temperature_2m_min[0] })
        }
      } catch { console.error('Error API clima') }
      if(montado) setCargando(false)
    }
    obtenerClima()
    return () => { montado = false }
  }, [destino])

  // La línea mide lo mismo cargando, sin dato y con dato: nada salta al llegar el clima.
  return (
    <div className="h-6 flex items-center text-sm text-tenue">
      {cargando ? <div className="esqueleto h-3 w-40" /> : clima && <p className="truncate">{clima.nombre}: máxima {clima.max}°, mínima {clima.min}°</p>}
    </div>
  )
}

function PrendaArrastrable({ cp, index, maxZ, setMaxZ, onGuardarEstado }) {
  const [pos, setPos] = useState({ x: cp.pos_x ?? 40, y: cp.pos_y ?? (index * 90 + 20) })
  const [zIndex, setZIndex] = useState(cp.z_index ?? 1)
  const [isDragging, setIsDragging] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const posRef = useRef(pos)
  const zRef = useRef(zIndex)
  const timerRef = useRef(null)
  useEffect(() => { posRef.current = pos }, [pos])
  useEffect(() => { zRef.current = zIndex }, [zIndex])
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const handlePointerDown = (e) => {
    vibrar(15)
    const rect = e.currentTarget.getBoundingClientRect()
    setOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    const nuevoZ = maxZ + 1
    setZIndex(nuevoZ)
    setMaxZ(nuevoZ)
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e) => {
    if (!isDragging) return
    const contenedor = e.currentTarget.parentElement.getBoundingClientRect()

    const itemSize = window.innerWidth >= 768 ? 128 : 112
    const nueva = limitarPosicion(
      e.clientX - contenedor.left - offset.x,
      e.clientY - contenedor.top - offset.y,
      contenedor.width,
      contenedor.height,
      itemSize
    )
    setPos(nueva)
  }

  const handlePointerUp = (e) => {
    if (!isDragging) return
    setIsDragging(false)
    e.currentTarget.releasePointerCapture(e.pointerId)
    // Clave por conjunto: la misma prenda puede estar en dos outfits a la vez.
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onGuardarEstado(cp.conjunto_id, cp.prenda_id, posRef.current.x, posRef.current.y, zRef.current)
    }, 800)
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, touchAction: 'none', zIndex: isDragging ? maxZ + 2 : zIndex }}
      className={`absolute w-28 h-28 md:w-32 md:h-32 flex items-center justify-center select-none ${isDragging ? 'scale-110 cursor-grabbing' : 'transition-transform duration-200 ease-suave cursor-grab'}`}
    >
      <img src={cp.prendas.imagen_url} loading="lazy" draggable="false" className="max-w-full max-h-full object-contain pointer-events-none drop-shadow-sm select-none" alt="Ropa" />
    </div>
  )
}

export default function VistaConjuntos({ onCrearMaleta, mostrarToast, setDialogoGlobal }) {
  const [maletas, setMaletas] = useState(() => leerCache('maletas') || [])
  const [conjuntos, setConjuntos] = useState([])
  const [cargando, setCargando] = useState(() => !leerCache('maletas'))
  const [busqueda, setBusqueda] = useState('')
  const [maletaActiva, setMaletaActiva] = useState(null)
  const [maxZ, setMaxZ] = useState(10)
  const [editandoNombre, setEditandoNombre] = useState(null)

  async function guardarNombre() {
    if (!editandoNombre) return
    const { tipo, id, valor } = editandoNombre
    setEditandoNombre(null)
    const nombre = valor.trim()
    if (!nombre) return
    const lista = tipo === 'maleta' ? maletas : conjuntos
    if (lista.find(x => x.id === id)?.nombre === nombre) return

    const { error } = await supabase.from(tipo === 'maleta' ? 'maletas' : 'conjuntos').update({ nombre }).eq('id', id)
    if (error) return mostrarToast('No se pudo cambiar el nombre', 'error')

    if (tipo === 'maleta') {
      const nuevas = maletas.map(m => m.id === id ? { ...m, nombre } : m)
      setMaletas(nuevas); guardarCache('maletas', nuevas)
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
        if (data) { setMaletas(data); guardarCache('maletas', data); }
      } else {
        const cache = leerCache(`conjuntos_${maletaActiva.id}`)
        if (cache) { setConjuntos(cache); setCargando(false); }
        const { data } = await supabase.from('conjuntos').select('id, nombre, conjunto_prenda ( conjunto_id, prenda_id, pos_x, pos_y, z_index, prendas ( id, imagen_url, categorias ( nombre ) ) )').eq('maleta_id', maletaActiva.id).order('nombre')
        if (data) { setConjuntos(data); guardarCache(`conjuntos_${maletaActiva.id}`, data); }
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
          const { error } = await supabase.from('maletas').delete().eq('id', id)
          if (error) return mostrarToast('No se pudo eliminar', 'error')
          const nuevas = maletas.filter(m => m.id !== id)
          setMaletas(nuevas); guardarCache('maletas', nuevas)
          setMaletaActiva(null)
        } else {
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
          // Una sola llamada con las relaciones anidadas.
          const { error } = await supabase.from('conjuntos').insert([{
            nombre: nuevoNombre,
            maleta_id: idMaletaDestino,
            conjunto_prenda: item.conjunto_prenda.map(cp => ({
              prenda_id: cp.prenda_id, pos_x: cp.pos_x, pos_y: cp.pos_y, z_index: cp.z_index
            }))
          }])
          if (error) return mostrarToast("Error al clonar.", "error")
          if (idMaletaDestino == maletaActiva?.id) setMaletaActiva({...maletaActiva}) 
          mostrarToast("Outfit clonado", "exito")
        } else {
          const { data: nuevaMaleta, error: errM } = await supabase.from('maletas').insert([{ nombre: nuevoNombre }]).select().single()
          if (errM || !nuevaMaleta) return mostrarToast("Error al clonar maleta.", "error")
          const { data: conjuntosViejos } = await supabase.from('conjuntos').select('id, nombre, conjunto_prenda(prenda_id, pos_x, pos_y, z_index)').eq('maleta_id', item.id)
          if (conjuntosViejos?.length) {
            const { error: errC } = await supabase.from('conjuntos').insert(conjuntosViejos.map(c => ({
              nombre: c.nombre,
              maleta_id: nuevaMaleta.id,
              conjunto_prenda: (c.conjunto_prenda || []).map(cp => ({
                prenda_id: cp.prenda_id, pos_x: cp.pos_x, pos_y: cp.pos_y, z_index: cp.z_index
              }))
            })))
            if (errC) return mostrarToast("Error al clonar los outfits", "error")
          }
          const { data: listaMaletas } = await supabase.from('maletas').select('*, conjuntos(id, conjunto_prenda(prendas(imagen_url)))').order('nombre')
          if (listaMaletas) { setMaletas(listaMaletas); guardarCache('maletas', listaMaletas) }
          setMaletaActiva(null)
          mostrarToast("Maleta clonada", "exito")
        }
        vibrar([50, 50])
      }
    })
  }

  async function exportarOutfit(id, nombre) {
    vibrar(30)
    const elemento = document.getElementById(`lienzo-${id}`)
    if (!elemento) return
    try {
      const dataUrl = await toPng(elemento, { cacheBust: true, pixelRatio: 2, skipFonts: true })
      if (navigator.share) {
        const res = await fetch(dataUrl)
        const blob = await res.blob()
        const file = new File([blob], `Outfit_${nombre.replace(/\s+/g, '_')}.png`, { type: 'image/png' })
        await navigator.share({ files: [file], title: `Outfit: ${nombre}` })
      } else {
        const a = document.createElement('a')
        a.href = dataUrl; a.download = `Outfit_${nombre.replace(/\s+/g, '_')}.png`; a.click()
      }
      vibrar([30, 30])
    } catch { mostrarToast("Error al exportar", "error") }
  }

  function abrirMaleta(maleta) {
    vibrar(20)
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

  async function actualizarEstado(conjuntoId, prendaId, x, y, z) {
    await supabase.from('conjunto_prenda').update({ pos_x: x, pos_y: y, z_index: z }).match({ conjunto_id: conjuntoId, prenda_id: prendaId })
  }

  const extraerImagenesMaleta = (maleta) => {
    if (!maleta.conjuntos) return []
    const urls = []
    maleta.conjuntos.forEach(c => {
      if (c.conjunto_prenda) {
        c.conjunto_prenda.forEach(cp => {
          if (cp.prendas?.imagen_url && !urls.includes(cp.prendas.imagen_url) && urls.length < 4) {
            urls.push(cp.prendas.imagen_url)
          }
        })
      }
    })
    return urls
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
          <WidgetClima destino={maletaActiva.nombre} />
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
            : [0, 1].map(i => <div key={i}><div className="esqueleto aspect-square" /><div className="h-12 mt-2 flex flex-col justify-center gap-2"><div className="esqueleto h-3 w-2/3" /><div className="esqueleto h-3 w-1/3" /></div></div>)}
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
            const imagenes = extraerImagenesMaleta(m)
            const outfits = m.conjuntos?.length || 0
            return (
              <button key={m.id} onClick={() => abrirMaleta(m)} className="min-w-0 self-start text-left rounded-xl">
                <span className={`aspect-square rounded-xl bg-foto p-3 grid gap-2 ${imagenes.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} ${imagenes.length > 2 ? 'grid-rows-2' : 'grid-rows-1'}`}>
                  {imagenes.length === 0
                    ? <span className="place-self-center text-tenue"><Icono nombre="maleta" className="w-12 h-12" /></span>
                    : imagenes.map(url => <Miniatura key={url} url={url} alt="" className="w-full h-full min-w-0 min-h-0 object-contain" />)}
                </span>
                <span className="block mt-2 font-semibold leading-6 truncate">{m.nombre}</span>
                <span className="block text-sm leading-6 text-tenue">{outfits === 1 ? '1 outfit' : `${outfits} outfits`}</span>
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

              <div id={`lienzo-${conj.id}`} data-sin-swipe className="relative w-full h-100 md:h-125 bg-foto overflow-hidden z-0">
                {conj.conjunto_prenda.filter(cp => cp.prendas).map((cp, idx) => (
                  <PrendaArrastrable key={cp.prenda_id} cp={cp} index={idx} maxZ={maxZ} setMaxZ={setMaxZ} onGuardarEstado={actualizarEstado} />
                ))}
              </div>
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