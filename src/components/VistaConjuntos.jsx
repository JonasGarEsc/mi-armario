import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { vibrar } from '../App'
import { toPng } from 'html-to-image'
import { leerCache, guardarCache } from '../lib/cache'
import { limitarPosicion } from '../lib/outfits'

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
      } catch (e) { console.error('Error API clima') }
      if(montado) setCargando(false)
    }
    obtenerClima()
    return () => { montado = false }
  }, [destino])

  if (cargando) return <div className="h-8 w-40 bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 animate-pulse rounded-md mt-1"></div>
  if (!clima) return null

  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 rounded-md border border-neutral-200/50 in-[.modo-oscuro]:border-neutral-800/50 w-max">
        <span className="text-xs">🌍</span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 in-[.modo-oscuro]:text-neutral-400">{clima.nombre}</span>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 rounded-md border border-neutral-200/50 in-[.modo-oscuro]:border-neutral-800/50 w-max">
        <span className="text-[11px] font-bold text-neutral-800 in-[.modo-oscuro]:text-neutral-200">{clima.max}°</span>
        <span className="text-neutral-300 in-[.modo-oscuro]:text-neutral-600">/</span>
        <span className="text-[11px] font-medium text-neutral-500 in-[.modo-oscuro]:text-neutral-500">{clima.min}°</span>
      </div>
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
      className={`absolute w-28 h-28 md:w-32 md:h-32 flex items-center justify-center select-none will-change-transform ${isDragging ? 'scale-110 cursor-grabbing' : 'transition-transform duration-300 ease-out cursor-grab'}`}
    >
      <img src={cp.prendas.imagen_url} loading="lazy" draggable="false" className="max-w-full max-h-full object-contain pointer-events-none drop-shadow-sm select-none" alt="Ropa" />
    </div>
  )
}

export default function VistaConjuntos({ onCrearMaleta, mostrarToast, setDialogoGlobal }) {
  const [maletas, setMaletas] = useState([])
  const [conjuntos, setConjuntos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [abriendo, setAbriendo] = useState(null)
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
          className={`${clases} bg-transparent border-b border-current outline-none text-center min-w-0`}
        />
      )
    }
    return (
      <button onClick={(e) => { e.stopPropagation(); setEditandoNombre({ tipo, id, valor: nombre }) }} title="Cambiar nombre" className={`${clases} truncate`}>
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
              <label className="block text-sm font-semibold mb-2">Destino:</label>
              <select onChange={(e) => idMaletaDestino = e.target.value} defaultValue={idMaletaDestino} className="w-full p-4 rounded-xl bg-neutral-100 in-[.modo-oscuro]:bg-neutral-800 outline-none">
                {maletas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold mb-2">Nuevo nombre:</label>
            <input type="text" onChange={(e) => nuevoNombre = e.target.value} defaultValue={nuevoNombre} className="w-full p-4 rounded-xl bg-neutral-100 in-[.modo-oscuro]:bg-neutral-800 outline-none" />
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
    } catch (e) { mostrarToast("Error al exportar", "error") }
  }

  function abrirMaleta(maleta) {
    vibrar(20)
    setAbriendo(maleta.id)
    setTimeout(() => { 
      setMaletaActiva(maleta)
      setAbriendo(null)
    }, 800)
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
    <div className="flex flex-col h-full w-full relative">
      <div className="flex flex-col gap-4 mb-5 md:mb-7 w-full shrink-0">
        {maletaActiva ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <button onClick={() => { setMaletaActiva(null); vibrar(20); }} aria-label="Volver a las maletas" className="w-8 h-8 flex items-center justify-center text-tenue hover:text-tinta active:opacity-60 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              {nombreEditable('maleta', maletaActiva.id, maletaActiva.nombre, 'font-display text-3xl md:text-5xl leading-none min-w-0')}
            </div>
            <div className="pl-11"><WidgetClima destino={maletaActiva.nombre} /></div>
          </div>
        ) : (
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl md:text-6xl leading-none">Maletas</h2>
            <button onClick={onCrearMaleta} className="shrink-0 bg-tinta text-papel text-[13px] md:text-sm px-4 md:px-5 py-2.5 md:py-3 mb-0.5 active:opacity-80 transition-opacity touch-manipulation">Nueva maleta</button>
          </div>
        )}

        <div className="flex items-center gap-3 border-b border-linea">
          <svg className="w-4 h-4 text-tenue shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" /></svg>
          <input type="text" autoComplete="off" aria-label="Buscar" placeholder={!maletaActiva ? 'Buscar maleta' : 'Buscar outfit'} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="flex-1 min-w-0 bg-transparent py-2.5 text-sm outline-none placeholder:text-tenue" />
        </div>
      </div>

      {cargando ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 px-1">
           {[...Array(6)].map((_, i) => <div key={i} className="aspect-2/3 bg-tinta/5 animate-pulse"></div>)}
        </div>
      ) : itemsFiltrados.length === 0 ? (
        <div className="flex-1 flex flex-col justify-center gap-2 py-16 md:py-24">
          <p className="font-display text-2xl md:text-3xl">{maletaActiva ? 'Esta maleta está vacía' : 'Todavía no hay maletas'}</p>
          <p className="text-sm text-tenue max-w-sm">{maletaActiva ? 'Elige prendas en el armario y crea un outfit para esta maleta.' : 'Crea una, elige prendas del armario y monta los outfits dentro.'}</p>
        </div>
      ) : !maletaActiva ? (
        <div className="rejilla gap-y-6 pt-2 pb-4 px-1">
          {itemsFiltrados.map((m) => (
            <div key={m.id} className="group relative flex flex-col items-center w-full min-w-0">
              <div className="absolute -top-2 right-0 flex flex-col gap-1 z-20 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                <button onClick={(e) => solicitarEliminar('maleta', m.id, e)} aria-label={`Eliminar ${m.nombre}`} className="w-8 h-8 flex items-center justify-center text-tenue hover:text-red-700 active:opacity-60 transition-colors">✕</button>
                <button onClick={(e) => solicitarClonar('maleta', m, e)} aria-label={`Duplicar ${m.nombre}`} className="w-8 h-8 flex items-center justify-center text-tenue hover:text-tinta active:opacity-60 transition-colors">⎘</button>
              </div>

              <div onClick={() => abrirMaleta(m)} className={`relative w-full max-w-30 md:max-w-36 aspect-2/3 perspective-[2000px] cursor-pointer transition-transform duration-400 active:scale-[0.98] md:hover:scale-[1.03] mb-1 md:mb-4 mx-auto drop-shadow-xl touch-manipulation`}>
                 <div className="absolute -top-3 md:-top-5 left-1/2 -translate-x-1/2 w-8 md:w-16 h-3 md:h-5 flex justify-between z-0">
                    <div className="w-0.75 h-full bg-linear-to-r from-neutral-300 via-neutral-100 to-neutral-400 in-[.modo-oscuro]:from-[#8a7258] in-[.modo-oscuro]:via-[#9d8568] in-[.modo-oscuro]:to-[#6b5743] border-x border-neutral-400 in-[.modo-oscuro]:border-[#3d3228]"></div>
                    <div className="w-0.75 h-full bg-linear-to-r from-neutral-300 via-neutral-100 to-neutral-400 in-[.modo-oscuro]:from-[#8a7258] in-[.modo-oscuro]:via-[#9d8568] in-[.modo-oscuro]:to-[#6b5743] border-x border-neutral-400 in-[.modo-oscuro]:border-[#3d3228]"></div>
                    <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-b from-neutral-200 to-neutral-400 in-[.modo-oscuro]:from-[#9d8568] in-[.modo-oscuro]:to-[#6b5743] rounded-t-sm"></div>
                 </div>
                 <div className="absolute -bottom-2 md:-bottom-3 left-1.5 md:left-3 w-3 md:w-4 h-3 bg-linear-to-b from-neutral-300 to-neutral-400 in-[.modo-oscuro]:from-[#8a7258] in-[.modo-oscuro]:to-[#3d3228] rounded-b-sm z-0 flex flex-col items-center justify-end shadow-md border-x border-neutral-400/50 in-[.modo-oscuro]:border-[#2a241d]">
                   <div className="w-3.5 h-1 bg-black rounded-full shadow-lg border border-neutral-400 in-[.modo-oscuro]:border-neutral-600"></div>
                 </div>
                 <div className="absolute -bottom-2 md:-bottom-3 right-1.5 md:right-3 w-3 md:w-4 h-3 bg-linear-to-b from-neutral-300 to-neutral-400 in-[.modo-oscuro]:from-[#8a7258] in-[.modo-oscuro]:to-[#3d3228] rounded-b-sm z-0 flex flex-col items-center justify-end shadow-md border-x border-neutral-400/50 in-[.modo-oscuro]:border-[#2a241d]">
                   <div className="w-3.5 h-1 bg-black rounded-full shadow-lg border border-neutral-400 in-[.modo-oscuro]:border-neutral-600"></div>
                 </div>

                 <div className="absolute top-0 left-0 w-full h-full bg-[#6f5b45] in-[.modo-oscuro]:bg-[#2a241d] rounded-sm border border-neutral-600 in-[.modo-oscuro]:border-[#9d8568] overflow-hidden z-10 flex flex-col justify-center">
                    <div className="absolute inset-1 border border-neutral-700/50 in-[.modo-oscuro]:border-[#9d8568]/30 z-10 overflow-hidden pointer-events-none">
                       <div className="absolute top-1/2 left-1/2 w-[150%] h-0.5 bg-neutral-800 in-[.modo-oscuro]:bg-[#3d3228] -translate-x-1/2 -translate-y-1/2 rotate-45"></div>
                       <div className="absolute top-1/2 left-1/2 w-[150%] h-0.5 bg-neutral-800 in-[.modo-oscuro]:bg-[#3d3228] -translate-x-1/2 -translate-y-1/2 -rotate-45"></div>
                    </div>
                    
                    <div className={`absolute inset-0 z-20 transition-all duration-600 ease-[cubic-bezier(0.16,1,0.3,1)] delay-150 ${abriendo === m.id ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-75'}`}>
                      {extraerImagenesMaleta(m).map((url, idx) => {
                         const posiciones = [
                           "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[85%] -rotate-6 z-10",
                           "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] rotate-12 z-20",
                           "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[75%] h-[75%] -rotate-12 z-30",
                           "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] rotate-6 z-40"
                         ]
                         return <img key={idx} src={url} className={`absolute ${posiciones[idx]} object-contain drop-shadow-[0_5px_10px_rgba(0,0,0,0.5)]`} alt="Prenda interior" />
                      })}
                    </div>
                 </div>

                 <div 
                   className="absolute top-0 left-0 w-full h-full rounded-sm origin-left transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] z-30 shadow-[3px_0_10px_rgba(0,0,0,0.6)] transform-3d"
                   style={{ transform: abriendo === m.id ? 'perspective(1500px) rotateY(-105deg)' : 'perspective(1500px) rotateY(0deg)', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                 >
                    <div className="absolute inset-0 bg-linear-to-br from-[#f1e7d7] via-[#ddc9ac] to-[#bfa385] in-[.modo-oscuro]:from-[#9d8568] in-[.modo-oscuro]:via-[#8a7258] in-[.modo-oscuro]:to-[#5d4b39] rounded-sm border border-white/60 in-[.modo-oscuro]:border-[#b8a184]/40 overflow-hidden">
                      <div className="absolute inset-0 flex justify-evenly px-0.5 md:px-2 py-1 md:py-4">
                          {[...Array(5)].map((_, i) => <div key={i} className="w-0.5 md:w-1 h-full bg-white/50 in-[.modo-oscuro]:bg-black/20 shadow-[1px_0_2px_rgba(0,0,0,0.1)]"></div>)}
                      </div>
                      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-4 md:w-8 h-0.75 bg-linear-to-b from-neutral-200 to-neutral-400 in-[.modo-oscuro]:from-[#b8a184] in-[.modo-oscuro]:to-[#6b5743] rounded-sm shadow-sm border border-neutral-500/40 in-[.modo-oscuro]:border-[#3d3228]"></div>
                    </div>
                 </div>
              </div>

              {nombreEditable('maleta', m.id, m.nombre, 'mt-3 font-display text-base md:text-lg text-center w-full px-1 max-w-full')}
              <p className="text-[11px] text-tenue">{m.conjuntos && m.conjuntos.length === 1 ? "1 outfit" : `${m.conjuntos ? m.conjuntos.length : 0} outfits`}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-4">
          {itemsFiltrados.map((conj) => (
            <div key={conj.id} className="relative border border-linea bg-tinta/[0.02] flex flex-col overflow-hidden isolate">
              
              <div className="flex justify-between items-center px-5 py-4 border-b border-linea bg-papel z-10 gap-2">
                {nombreEditable('outfit', conj.id, conj.nombre, 'font-display text-xl leading-none min-w-0 flex-1 text-left')}
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => exportarOutfit(conj.id, conj.nombre)} aria-label={`Descargar imagen de ${conj.nombre}`} className="text-tenue hover:text-tinta active:opacity-60 p-2">↓</button>
                  <button onClick={(e) => solicitarClonar('outfit', conj, e)} aria-label={`Duplicar ${conj.nombre}`} className="text-tenue hover:text-tinta active:opacity-60 p-2">⎘</button>
                  <button onClick={(e) => solicitarEliminar('outfit', conj.id, e)} aria-label={`Eliminar ${conj.nombre}`} className="text-tenue hover:text-red-700 active:opacity-60 p-2">✕</button>
                </div>
              </div>
              
              <div id={`lienzo-${conj.id}`} className="relative w-full h-100 md:h-125 bg-papel overflow-hidden touch-none z-0">
                <div className="absolute inset-0 opacity-[0.03] in-[.modo-oscuro]:opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                {conj.conjunto_prenda.filter(cp => cp.prendas).map((cp, idx) => (
                  <PrendaArrastrable key={cp.prenda_id} cp={cp} index={idx} maxZ={maxZ} setMaxZ={setMaxZ} onGuardarEstado={actualizarEstado} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}