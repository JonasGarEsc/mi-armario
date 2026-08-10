import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { vibrar } from '../App'
import html2canvas from 'html2canvas'

function PrendaArrastrable({ cp, index, maxZ, setMaxZ, onGuardarEstado }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const [pos, setPos] = useState({ x: cp.pos_x ?? 40, y: cp.pos_y ?? (index * 90 + 20) })
  const [zIndex, setZIndex] = useState(cp.z_index ?? 10)
  const [isDragging, setIsDragging] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const posRef = useRef(pos)
  const zRef = useRef(zIndex)
  useEffect(() => { posRef.current = pos }, [pos])
  useEffect(() => { zRef.current = zIndex }, [zIndex])

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
    let newX = e.clientX - contenedor.left - offset.x
    let newY = e.clientY - contenedor.top - offset.y

    const itemSize = window.innerWidth >= 768 ? 128 : 112
    const maxAncho = contenedor.width - itemSize
    const maxAlto = contenedor.height - itemSize

    if (newX < 0) newX = 0
    if (newY < 0) newY = 0
    if (newX > maxAncho) newX = maxAncho
    if (newY > maxAlto) newY = maxAlto

    setPos({ x: newX, y: newY })
  }

  const handlePointerUp = (e) => {
    if (!isDragging) return
    setIsDragging(false)
    e.currentTarget.releasePointerCapture(e.pointerId)
    const timerKey = `timer_cp_${cp.prenda_id}`
    if (window[timerKey]) clearTimeout(window[timerKey])
    window[timerKey] = setTimeout(() => {
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

export default function VistaConjuntos({ onCrearMaleta }) {
  const [maletas, setMaletas] = useState([])
  const [conjuntos, setConjuntos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [abriendo, setAbriendo] = useState(null)
  const [maletaActiva, setMaletaActiva] = useState(null)
  
  const [dialogoInfo, setDialogoInfo] = useState(null)
  const [dialogoVisible, setDialogoVisible] = useState(false)
  const [conjuntoADuplicar, setConjuntoADuplicar] = useState(null)
  const [maletaADuplicar, setMaletaADuplicar] = useState(null)
  const [modalOperacionVisible, setModalOperacionVisible] = useState(false)
  
  const [maxZ, setMaxZ] = useState(100)

  useEffect(() => {
    async function cargarDatos() {
      if (!maletaActiva) {
        const cache = localStorage.getItem('cache_maletas')
        if (cache) { setMaletas(JSON.parse(cache)); setCargando(false); }
        const { data } = await supabase.from('maletas').select('*, conjuntos(id)').order('nombre')
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

  function confirmarAccion(tipo, id, mensaje) {
    vibrar(30)
    setDialogoInfo({ tipo, id, mensaje })
    requestAnimationFrame(() => requestAnimationFrame(() => setDialogoVisible(true)))
  }

  function cerrarDialogo() {
    setDialogoVisible(false)
    setTimeout(() => setDialogoInfo(null), 200)
  }

  async function ejecutarEliminacion() {
    const { tipo, id } = dialogoInfo
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
    cerrarDialogo()
  }

  function abrirOperacion(tipo, item, e) {
    if(e) e.stopPropagation()
    vibrar(20)
    if (tipo === 'clonarOutfit') setConjuntoADuplicar(item)
    if (tipo === 'clonarMaleta') setMaletaADuplicar(item)
    requestAnimationFrame(() => requestAnimationFrame(() => setModalOperacionVisible(true)))
  }

  function cerrarOperacion() {
    setModalOperacionVisible(false)
    setTimeout(() => {
      setConjuntoADuplicar(null)
      setMaletaADuplicar(null)
    }, 300)
  }

  async function procesarDuplicado(e) {
    e.preventDefault()
    if (conjuntoADuplicar) {
      const maletaDestino = e.target.maletaId.value
      const nombre = e.target.nombre.value
      const { data: nuevoConj, error } = await supabase.from('conjuntos').insert([{ nombre, maleta_id: maletaDestino }]).select().single()
      if (error) return alert("Error al clonar.")
      const copiasRelaciones = conjuntoADuplicar.conjunto_prenda.map(cp => ({
        conjunto_id: nuevoConj.id, prenda_id: cp.prenda_id, pos_x: cp.pos_x, pos_y: cp.pos_y, z_index: cp.z_index
      }))
      await supabase.from('conjunto_prenda').insert(copiasRelaciones)
      if (maletaDestino == maletaActiva.id) setMaletaActiva({...maletaActiva}) 
    } 
    else if (maletaADuplicar) {
      const nombre = e.target.nombre.value
      const { data: nuevaMaleta, error: errM } = await supabase.from('maletas').insert([{ nombre }]).select().single()
      if (errM) return alert("Error al clonar maleta.")
      const { data: conjuntosViejos } = await supabase.from('conjuntos').select('id, nombre, conjunto_prenda(prenda_id, pos_x, pos_y, z_index)').eq('maleta_id', maletaADuplicar.id)
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
      const { data: listaMaletas } = await supabase.from('maletas').select('*, conjuntos(id)').order('nombre')
      setMaletas(listaMaletas); localStorage.setItem('cache_maletas', JSON.stringify(listaMaletas))
    }
    vibrar([50, 50])
    cerrarOperacion()
  }

  async function exportarOutfit(id, nombre) {
    vibrar(30)
    const elemento = document.getElementById(`lienzo-${id}`)
    if (!elemento) return
    try {
      const canvas = await html2canvas(elemento, { useCORS: true, scale: 2, backgroundColor: null })
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/jpeg', 0.9)
      a.download = `Outfit_${nombre.replace(/\s+/g, '_')}.jpg`
      a.click()
    } catch (e) { alert("Error al generar imagen.") }
  }

  function abrirMaleta(maleta) {
    vibrar(20); setAbriendo(maleta.id)
    setTimeout(() => { setMaletaActiva(maleta); setAbriendo(null); }, 400)
  }

  async function actualizarEstado(conjuntoId, prendaId, x, y, z) {
    await supabase.from('conjunto_prenda').update({ pos_x: x, pos_y: y, z_index: z }).match({ conjunto_id: conjuntoId, prenda_id: prendaId })
  }

  const itemsFiltrados = !maletaActiva ? maletas.filter(m => m.nombre.toLowerCase().includes(busqueda.toLowerCase())) : conjuntos.filter(c => c.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  return (
    <div className="flex flex-col h-full w-full relative">
      <div className="flex flex-col gap-3 mb-4 w-full">
        {maletaActiva && (
          <div className="flex items-center gap-2">
            <button onClick={() => { setMaletaActiva(null); vibrar(20); }} className="w-10 h-10 flex items-center justify-center rounded-full bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 active:scale-90 transition-transform">←</button>
            <h3 className="font-bold text-lg tracking-tight truncate">{maletaActiva.nombre}</h3>
          </div>
        )}

        <div className="flex w-full gap-2">
          <input type="text" autoComplete="off" placeholder={!maletaActiva ? "Buscar maleta..." : "Buscar conjunto..."} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="flex-1 bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 rounded-full px-4 py-2.5 text-sm outline-none placeholder-neutral-500 border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-700 transition-colors" />
          {!maletaActiva && (
            <button onClick={onCrearMaleta} className="bg-black in-[.modo-oscuro]:bg-white text-white in-[.modo-oscuro]:text-black px-5 py-2.5 rounded-full font-semibold active:scale-[0.98] transition-transform text-sm">+ Maleta</button>
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
        /* CUADRÍCULA ESTRICTA DE 3 COLUMNAS PARA MALETAS */
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-2 gap-y-6 pt-2 pb-4 px-1">
          {itemsFiltrados.map((m) => (
            <div key={m.id} className="relative flex flex-col items-center w-full">
              <div className="absolute -top-2 right-0 flex flex-col gap-1 z-20">
                <button onClick={(e) => confirmarAccion('maleta', m.id, '¿Eliminar maleta?')} className="w-6 h-6 bg-white in-[.modo-oscuro]:bg-neutral-800 text-red-500 rounded-full flex items-center justify-center shadow-sm text-[10px] active:scale-90 border border-neutral-100 in-[.modo-oscuro]:border-neutral-700">✕</button>
                <button onClick={(e) => abrirOperacion('clonarMaleta', m, e)} className="w-6 h-6 bg-white in-[.modo-oscuro]:bg-neutral-800 text-black in-[.modo-oscuro]:text-white rounded-full flex items-center justify-center shadow-sm text-[10px] active:scale-90 border border-neutral-100 in-[.modo-oscuro]:border-neutral-700">⎘</button>
              </div>

              <div onClick={() => abrirMaleta(m)} className={`w-full aspect-2/3 max-w-30 bg-neutral-200 in-[.modo-oscuro]:bg-neutral-800 rounded-xl relative cursor-pointer overflow-hidden shadow-sm active:scale-[0.98] transition-all duration-300 ${abriendo === m.id ? 'opacity-0 scale-90' : 'opacity-100'}`}>
                {/* Detalles gráficos maleta minimalista */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-neutral-300 in-[.modo-oscuro]:bg-neutral-600 rounded-full"></div>
                <div className="absolute bottom-2 w-full flex justify-between px-3"><div className="w-2 h-2 bg-neutral-400 in-[.modo-oscuro]:bg-neutral-950 rounded-full"></div><div className="w-2 h-2 bg-neutral-400 in-[.modo-oscuro]:bg-neutral-950 rounded-full"></div></div>
                <div className="absolute inset-0 flex flex-col justify-center px-2 opacity-30"><div className="w-full h-px bg-black my-1"></div><div className="w-full h-px bg-black my-1"></div><div className="w-full h-px bg-black my-1"></div></div>
              </div>
              <p className="mt-2 font-semibold text-[11px] md:text-sm text-center w-full truncate px-1">{m.nombre}</p>
              <p className="text-[9px] text-neutral-500">{m.conjuntos ? m.conjuntos.length : 0} looks</p>
            </div>
          ))}
        </div>
      ) : (
        /* OUTFITS: 1 COLUMNA */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-4">
          {itemsFiltrados.map((conj, i) => (
            <div key={conj.id} className="relative border border-neutral-200 in-[.modo-oscuro]:border-neutral-800 rounded-3xl bg-neutral-50 in-[.modo-oscuro]:bg-neutral-900/50 flex flex-col overflow-hidden">
              
              <div className="flex justify-between items-center px-5 py-4 border-b border-neutral-200 in-[.modo-oscuro]:border-neutral-800 bg-white in-[.modo-oscuro]:bg-neutral-900">
                <h3 className="font-bold text-sm truncate pr-4">{conj.nombre}</h3>
                <div className="flex gap-2">
                  <button onClick={() => exportarOutfit(conj.id, conj.nombre)} className="text-neutral-500 active:text-black in-[.modo-oscuro]:active:text-white px-2">↓</button>
                  <button onClick={() => abrirOperacion('clonarOutfit', conj)} className="text-neutral-500 active:text-black in-[.modo-oscuro]:active:text-white px-2">⎘</button>
                  <button onClick={() => confirmarAccion('conjunto', conj.id, '¿Eliminar outfit?')} className="text-red-400 active:text-red-600 px-2">✕</button>
                </div>
              </div>
              
              <div id={`lienzo-${conj.id}`} className="relative w-full h-100 md:h-125 bg-neutral-50 in-[.modo-oscuro]:bg-neutral-950 overflow-hidden touch-none">
                {/* Cuadrícula sutil de fondo para alinear */}
                <div className="absolute inset-0 opacity-[0.03] in-[.modo-oscuro]:opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                {conj.conjunto_prenda.map((cp, idx) => (
                  <PrendaArrastrable key={cp.prendas.id} cp={cp} index={idx} maxZ={maxZ} setMaxZ={setMaxZ} onGuardarEstado={actualizarEstado} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Clonar Minimalista */}
      {(conjuntoADuplicar || maletaADuplicar) && (
        <div className={`fixed inset-0 bg-black/60 flex items-end justify-center z-100 transition-opacity duration-300 ${modalOperacionVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex-1 w-full" onClick={cerrarOperacion}></div>
          <form onSubmit={procesarDuplicado} className={`bg-white in-[.modo-oscuro]:bg-neutral-900 w-full max-w-md rounded-t-3xl p-6 pb-12 transition-transform duration-400 ease-[cubic-bezier(0.25,1,0.5,1)] ${modalOperacionVisible ? 'translate-y-0' : 'translate-y-full'}`}>
            <h3 className="text-xl font-bold mb-4">{conjuntoADuplicar ? 'Duplicar Outfit' : 'Duplicar Maleta'}</h3>
            
            {conjuntoADuplicar && (
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Destino:</label>
                <select name="maletaId" required className="w-full p-3 rounded-lg bg-neutral-100 in-[.modo-oscuro]:bg-neutral-800 outline-none">
                  {maletas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2">Nuevo nombre:</label>
              <input type="text" name="nombre" autoComplete="off" defaultValue={`${(conjuntoADuplicar || maletaADuplicar).nombre} (Copia)`} required className="w-full p-3 rounded-lg bg-neutral-100 in-[.modo-oscuro]:bg-neutral-800 outline-none" />
            </div>

            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-black in-[.modo-oscuro]:bg-white text-white in-[.modo-oscuro]:text-black font-semibold py-3 rounded-xl active:scale-[0.98]">Clonar</button>
              <button type="button" onClick={cerrarOperacion} className="flex-1 bg-neutral-100 in-[.modo-oscuro]:bg-neutral-800 font-semibold py-3 rounded-xl active:scale-[0.98]">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Confirmación Eliminar */}
      {dialogoInfo && (
        <div className={`fixed inset-0 bg-black/60 flex items-center justify-center z-100 p-4 transition-opacity duration-200 ${dialogoVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`bg-white in-[.modo-oscuro]:bg-neutral-900 rounded-2xl p-6 w-full max-w-sm text-center transition-transform duration-300 ${dialogoVisible ? 'scale-100' : 'scale-95'}`}>
            <h3 className="text-lg font-semibold mb-6">{dialogoInfo.mensaje}</h3>
            <div className="flex flex-col gap-2">
              <button onClick={ejecutarEliminacion} className="w-full text-red-500 font-bold py-3 rounded-xl bg-red-50 in-[.modo-oscuro]:bg-red-950/30 active:opacity-70">Eliminar</button>
              <button onClick={cerrarDialogo} className="w-full font-semibold py-3 rounded-xl active:bg-neutral-100 in-[.modo-oscuro]:active:bg-neutral-800">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}