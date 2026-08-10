import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { vibrar } from '../App'
import { toJpeg } from 'html-to-image'

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
  const [zIndex, setZIndex] = useState(cp.z_index ?? 1)
  const [isDragging, setIsDragging] = useState(false)
  
  // Referencias para evitar re-renderizados de React durante el movimiento
  const domRef = useRef(null)
  const coordRef = useRef({ x: cp.pos_x ?? 40, y: cp.pos_y ?? (index * 90 + 20) })
  const offsetRef = useRef({ x: 0, y: 0 })
  const rafRef = useRef(null)

  // Establecer posición inicial
  useEffect(() => {
    if (domRef.current) {
      domRef.current.style.transform = `translate3d(${coordRef.current.x}px, ${coordRef.current.y}px, 0)`
    }
  }, [])

  const handlePointerDown = (e) => {
    vibrar(15)
    const rect = e.currentTarget.getBoundingClientRect()
    offsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    
    const nuevoZ = maxZ + 1
    setZIndex(nuevoZ)
    setMaxZ(nuevoZ)
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e) => {
    if (!isDragging) return
    
    const contenedor = e.currentTarget.parentElement.getBoundingClientRect()
    let newX = e.clientX - contenedor.left - offsetRef.current.x
    let newY = e.clientY - contenedor.top - offsetRef.current.y

    const itemSize = window.innerWidth >= 768 ? 128 : 112
    const maxAncho = contenedor.width - itemSize
    const maxAlto = contenedor.height - itemSize

    if (newX < 0) newX = 0
    if (newY < 0) newY = 0
    if (newX > maxAncho) newX = maxAncho
    if (newY > maxAlto) newY = maxAlto

    coordRef.current = { x: newX, y: newY }

    // Manipulación directa del DOM usando requestAnimationFrame (Aceleración GPU)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      if (domRef.current) {
        domRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`
      }
    })
  }

  const handlePointerUp = (e) => {
    if (!isDragging) return
    setIsDragging(false)
    e.currentTarget.releasePointerCapture(e.pointerId)
    
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    
    const timerKey = `timer_cp_${cp.prenda_id}`
    if (window[timerKey]) clearTimeout(window[timerKey])
    window[timerKey] = setTimeout(() => {
      onGuardarEstado(cp.conjunto_id, cp.prenda_id, coordRef.current.x, coordRef.current.y, zIndex)
    }, 500)
  }

  return (
    <div
      ref={domRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ touchAction: 'none', zIndex: isDragging ? maxZ + 2 : zIndex }}
      className={`absolute w-28 h-28 md:w-32 md:h-32 flex items-center justify-center select-none will-change-transform ${isDragging ? 'scale-110 cursor-grabbing' : 'transition-[scale,z-index] duration-300 ease-out cursor-grab'}`}
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

  useEffect(() => {
    async function cargarDatos() {
      if (!maletaActiva) {
        const cache = localStorage.getItem('cache_maletas')
        if (cache) { setMaletas(JSON.parse(cache)); setCargando(false); }
        const { data } = await supabase.from('maletas').select('*, conjuntos(id, conjunto_prenda(prendas(imagen_url)))').order('nombre')
        if (data) { setMaletas(data); localStorage.setItem('cache_maletas', JSON.stringify(data)); }
      } else {
        const cache = localStorage.getItem(`cache_conjuntos_${maletaActiva.id}`)
        if (cache) { setConjuntos(JSON.parse(cache)); setCargando(false); }
        const { data } = await supabase.from('conjuntos').select('id, nombre, conjunto_prenda ( conjunto_id, prenda_id, pos_x, pos_y, z_index, prendas ( id, imagen_url, categorias ( nombre ) ) )').eq('maleta_id', maletaActiva.id).order('nombre')
        if (data) { setConjuntos(data); localStorage.setItem(`cache_conjuntos_${maletaActiva.id}`, JSON.stringify(data)); }
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
          await supabase.from('maletas').delete().eq('id', id)
          const nuevas = maletas.filter(m => m.id !== id)
          setMaletas(nuevas); localStorage.setItem('cache_maletas', JSON.stringify(nuevas))
        } else {
          await supabase.from('conjuntos').delete().eq('id', id)
          const nuevos = conjuntos.filter(c => c.id !== id)
          setConjuntos(nuevos); localStorage.setItem(`cache_conjuntos_${maletaActiva.id}`, JSON.stringify(nuevos))
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
          const { data: nuevoConj, error } = await supabase.from('conjuntos').insert([{ nombre: nuevoNombre, maleta_id: idMaletaDestino }]).select().single()
          if (error) return mostrarToast("Error al clonar.", "error")
          const copiasRelaciones = item.conjunto_prenda.map(cp => ({
            conjunto_id: nuevoConj.id, prenda_id: cp.prenda_id, pos_x: cp.pos_x, pos_y: cp.pos_y, z_index: cp.z_index
          }))
          await supabase.from('conjunto_prenda').insert(copiasRelaciones)
          if (idMaletaDestino == maletaActiva?.id) setMaletaActiva({...maletaActiva}) 
          mostrarToast("Outfit clonado", "exito")
        } else {
          const { data: nuevaMaleta, error: errM } = await supabase.from('maletas').insert([{ nombre: nuevoNombre }]).select().single()
          if (errM) return mostrarToast("Error al clonar maleta.", "error")
          const { data: conjuntosViejos } = await supabase.from('conjuntos').select('id, nombre, conjunto_prenda(prenda_id, pos_x, pos_y, z_index)').eq('maleta_id', item.id)
          if (conjuntosViejos) {
            for (const cViejo of conjuntosViejos) {
              const { data: cNuevo } = await supabase.from('conjuntos').insert([{ nombre: cViejo.nombre, maleta_id: nuevaMaleta.id }]).select().single()
              if (cNuevo && cViejo.conjunto_prenda.length > 0) {
                const copiasRel = cViejo.conjunto_prenda.map(cp => ({
                  conjunto_id: cNuevo.id, prenda_id: cp.prenda_id, pos_x: cp.pos_x, pos_y: cp.pos_y, z_index: cp.z_index
                }))
                await supabase.from('conjunto_prenda').insert(copiasRel)
              }
            }
          }
          const { data: listaMaletas } = await supabase.from('maletas').select('*, conjuntos(id, conjunto_prenda(prendas(imagen_url)))').order('nombre')
          setMaletas(listaMaletas); localStorage.setItem('cache_maletas', JSON.stringify(listaMaletas))
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
      const dataUrl = await toJpeg(elemento, { cacheBust: true, pixelRatio: 2, quality: 0.85, skipFonts: true })
      if (navigator.share) {
        const res = await fetch(dataUrl)
        const blob = await res.blob()
        const file = new File([blob], `Outfit_${nombre.replace(/\s+/g, '_')}.jpg`, { type: 'image/jpeg' })
        await navigator.share({ files: [file], title: `Outfit: ${nombre}` })
      } else {
        const a = document.createElement('a')
        a.href = dataUrl; a.download = `Outfit_${nombre.replace(/\s+/g, '_')}.jpg`; a.click()
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
      <div className="flex flex-col gap-3 mb-4 w-full">
        {maletaActiva && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <button onClick={() => { setMaletaActiva(null); vibrar(20); }} className="w-10 h-10 flex items-center justify-center rounded-full bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 active:scale-90 transition-transform">←</button>
              <h3 className="font-bold text-lg tracking-tight truncate">{maletaActiva.nombre}</h3>
            </div>
            <WidgetClima destino={maletaActiva.nombre} />
          </div>
        )}

        <div className="flex w-full gap-2 shrink-0">
          <input type="text" autoComplete="off" placeholder={!maletaActiva ? "Buscar maleta..." : "Buscar conjunto..."} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="flex-1 bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 rounded-full px-4 py-3 text-sm outline-none placeholder-neutral-500 border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-700 transition-colors" />
          {!maletaActiva && (
            <button onClick={onCrearMaleta} className="bg-black in-[.modo-oscuro]:bg-white text-white in-[.modo-oscuro]:text-black px-5 py-3 rounded-full font-semibold active:scale-[0.98] transition-transform text-sm">+ Maleta</button>
          )}
        </div>
      </div>

      {cargando ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 px-1">
           {[...Array(6)].map((_, i) => <div key={i} className="aspect-3/4 bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 rounded-lg animate-pulse"></div>)}
        </div>
      ) : itemsFiltrados.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">Vacío.</div>
      ) : !maletaActiva ? (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-2 gap-y-6 pt-2 pb-4 px-1">
          {itemsFiltrados.map((m) => (
            <div key={m.id} className="relative flex flex-col items-center w-full">
              <div className="absolute -top-2 right-0 flex flex-col gap-1 z-20">
                <button onClick={(e) => solicitarEliminar('maleta', m.id, e)} className="w-6 h-6 bg-white in-[.modo-oscuro]:bg-neutral-800 text-red-500 rounded-full flex items-center justify-center shadow-sm text-[10px] active:scale-90 border border-neutral-100 in-[.modo-oscuro]:border-neutral-700">✕</button>
                <button onClick={(e) => solicitarClonar('maleta', m, e)} className="w-6 h-6 bg-white in-[.modo-oscuro]:bg-neutral-800 text-black in-[.modo-oscuro]:text-white rounded-full flex items-center justify-center shadow-sm text-[10px] active:scale-90 border border-neutral-100 in-[.modo-oscuro]:border-neutral-700">⎘</button>
              </div>

              <div onClick={() => abrirMaleta(m)} className={`relative w-full max-w-30 aspect-2/3 perspective-[2000px] cursor-pointer transition-transform duration-400 active:scale-[0.98] md:hover:scale-[1.03] mb-1 md:mb-4 mx-auto drop-shadow-xl touch-manipulation`}>
                 <div className="absolute -top-3 md:-top-5 left-1/2 -translate-x-1/2 w-8 md:w-16 h-3 md:h-5 flex justify-between z-0">
                    <div className="w-0.75 h-full bg-linear-to-r from-neutral-300 via-neutral-100 to-neutral-400 in-[.modo-oscuro]:from-[#3B3852] in-[.modo-oscuro]:via-[#494463] in-[.modo-oscuro]:to-[#2E2A44] border-x border-neutral-400 in-[.modo-oscuro]:border-[#1F1D2B]"></div>
                    <div className="w-0.75 h-full bg-linear-to-r from-neutral-300 via-neutral-100 to-neutral-400 in-[.modo-oscuro]:from-[#3B3852] in-[.modo-oscuro]:via-[#494463] in-[.modo-oscuro]:to-[#2E2A44] border-x border-neutral-400 in-[.modo-oscuro]:border-[#1F1D2B]"></div>
                    <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-b from-neutral-200 to-neutral-400 in-[.modo-oscuro]:from-[#494463] in-[.modo-oscuro]:to-[#2E2A44] rounded-t-sm"></div>
                 </div>
                 <div className="absolute -bottom-2 md:-bottom-3 left-1.5 md:left-3 w-3 md:w-4 h-3 bg-linear-to-b from-neutral-300 to-neutral-400 in-[.modo-oscuro]:from-[#3B3852] in-[.modo-oscuro]:to-[#1F1D2B] rounded-b-sm z-0 flex flex-col items-center justify-end shadow-md border-x border-neutral-400/50 in-[.modo-oscuro]:border-[#13111C]">
                   <div className="w-3.5 h-1 bg-black rounded-full shadow-lg border border-neutral-400 in-[.modo-oscuro]:border-neutral-600"></div>
                 </div>
                 <div className="absolute -bottom-2 md:-bottom-3 right-1.5 md:right-3 w-3 md:w-4 h-3 bg-linear-to-b from-neutral-300 to-neutral-400 in-[.modo-oscuro]:from-[#3B3852] in-[.modo-oscuro]:to-[#1F1D2B] rounded-b-sm z-0 flex flex-col items-center justify-end shadow-md border-x border-neutral-400/50 in-[.modo-oscuro]:border-[#13111C]">
                   <div className="w-3.5 h-1 bg-black rounded-full shadow-lg border border-neutral-400 in-[.modo-oscuro]:border-neutral-600"></div>
                 </div>

                 <div className="absolute top-0 left-0 w-full h-full bg-[#1e293b] in-[.modo-oscuro]:bg-[#13111C] rounded-xl md:rounded-3xl border border-neutral-600 in-[.modo-oscuro]:border-[#494463] overflow-hidden z-10 flex flex-col justify-center">
                    <div className="absolute inset-1 border border-neutral-700/50 in-[.modo-oscuro]:border-[#494463]/30 rounded-lg z-10 overflow-hidden pointer-events-none">
                       <div className="absolute top-1/2 left-1/2 w-[150%] h-0.5 bg-neutral-800 in-[.modo-oscuro]:bg-[#1F1D2B] -translate-x-1/2 -translate-y-1/2 rotate-45"></div>
                       <div className="absolute top-1/2 left-1/2 w-[150%] h-0.5 bg-neutral-800 in-[.modo-oscuro]:bg-[#1F1D2B] -translate-x-1/2 -translate-y-1/2 -rotate-45"></div>
                    </div>
                    
                    <div className={`absolute inset-0 z-20 transition-all duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] delay-[150ms] ${abriendo === m.id ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-75'}`}>
                      {extraerImagenesMaleta(m).map((url, idx) => {
                        const posiciones = [
                          "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[85%] -rotate-6 z-10",
                          "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] rotate-12 z-20",
                          "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[75%] h-[75%] -rotate-12 z-30",
                          "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] rotate-6 z-40"
                        ]
                        return <img key={idx} src={`${url}?width=150&quality=70`} className={`absolute ${posiciones[idx]} object-contain drop-shadow-[0_5px_10px_rgba(0,0,0,0.5)]`} alt="Prenda interior" />
                      })}
                    </div>
                 </div>

                 <div 
                   className="absolute top-0 left-0 w-full h-full rounded-xl md:rounded-3xl origin-left transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] z-30 shadow-[3px_0_10px_rgba(0,0,0,0.6)] transform-3d"
                   style={{ transform: abriendo === m.id ? 'perspective(1500px) rotateY(-105deg)' : 'perspective(1500px) rotateY(0deg)', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                 >
                    <div className="absolute inset-0 bg-linear-to-br from-[#f8fafc] via-[#cbd5e1] to-[#94a3b8] in-[.modo-oscuro]:from-[#494463] in-[.modo-oscuro]:via-[#3B3852] in-[.modo-oscuro]:to-[#2A273F] rounded-xl md:rounded-3xl border border-white/60 in-[.modo-oscuro]:border-[#7A7593]/40 overflow-hidden">
                      <div className="absolute inset-0 flex justify-evenly px-0.5 md:px-2 py-1 md:py-4">
                          {[...Array(5)].map((_, i) => <div key={i} className="w-0.5 md:w-1 h-full bg-white/50 in-[.modo-oscuro]:bg-black/20 shadow-[1px_0_2px_rgba(0,0,0,0.1)]"></div>)}
                      </div>
                      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-4 md:w-8 h-0.75 bg-linear-to-b from-neutral-200 to-neutral-400 in-[.modo-oscuro]:from-[#7A7593] in-[.modo-oscuro]:to-[#2E2A44] rounded-sm shadow-sm border border-neutral-500/40 in-[.modo-oscuro]:border-[#1F1D2B]"></div>
                    </div>
                 </div>
              </div>

              <p className="mt-2 font-semibold text-[11px] md:text-sm text-center w-full truncate px-1">{m.nombre}</p>
              <p className="text-[9px] text-neutral-500">{m.conjuntos ? m.conjuntos.length : 0} looks</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-4">
          {itemsFiltrados.map((conj, i) => (
            <div key={conj.id} className="relative border border-neutral-200 in-[.modo-oscuro]:border-neutral-800 rounded-3xl bg-neutral-50 in-[.modo-oscuro]:bg-neutral-900/50 flex flex-col overflow-hidden isolate">
              
              <div className="flex justify-between items-center px-5 py-4 border-b border-neutral-200 in-[.modo-oscuro]:border-neutral-800 bg-white in-[.modo-oscuro]:bg-neutral-900 z-10">
                <h3 className="font-bold text-sm truncate pr-4">{conj.nombre}</h3>
                <div className="flex gap-2">
                  <button onClick={() => exportarOutfit(conj.id, conj.nombre)} className="text-neutral-500 active:text-black in-[.modo-oscuro]:active:text-white px-2">↓</button>
                  <button onClick={(e) => solicitarClonar('outfit', conj, e)} className="text-neutral-500 active:text-black in-[.modo-oscuro]:active:text-white px-2">⎘</button>
                  <button onClick={(e) => solicitarEliminar('outfit', conj.id, e)} className="text-red-400 active:text-red-600 px-2">✕</button>
                </div>
              </div>
              
              <div id={`lienzo-${conj.id}`} className="relative w-full h-100 md:h-125 bg-neutral-50 in-[.modo-oscuro]:bg-neutral-950 overflow-hidden touch-none z-0">
                <div className="absolute inset-0 opacity-[0.03] in-[.modo-oscuro]:opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                {conj.conjunto_prenda.map((cp, idx) => (
                  <PrendaArrastrable key={cp.prendas.id} cp={cp} index={idx} maxZ={maxZ} setMaxZ={setMaxZ} onGuardarEstado={actualizarEstado} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}