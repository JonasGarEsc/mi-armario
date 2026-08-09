import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

function PrendaArrastrable({ cp, index, maxZ, setMaxZ, onGuardarEstado }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const [pos, setPos] = useState({ 
    x: cp.pos_x ?? 40, 
    y: cp.pos_y ?? (index * 90 + 20) 
  })
  const [zIndex, setZIndex] = useState(cp.z_index ?? 10)
  const [isDragging, setIsDragging] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  // Referencias para el debouncing
  const posRef = useRef(pos)
  const zRef = useRef(zIndex)
  useEffect(() => { posRef.current = pos }, [pos])
  useEffect(() => { zRef.current = zIndex }, [zIndex])

  const handlePointerDown = (e) => {
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
    
    // Debouncing: Espera 800ms antes de llamar a la base de datos
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
      className={`absolute w-28 h-28 md:w-32 md:h-32 flex items-center justify-center select-none [-webkit-tap-highlight-color:transparent] ${isDragging ? 'scale-110 cursor-grabbing' : 'transition-transform cursor-grab active:scale-105'}`}
    >
      <img src={cp.prendas.imagen_url} draggable="false" className="max-w-full max-h-full object-contain pointer-events-none drop-shadow-md select-none" alt="Ropa" />
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
  const [dialogoConfirmacion, setDialogoConfirmacion] = useState(null)
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

  function solicitarEliminacionMaleta(id, e) {
    e.stopPropagation()
    setDialogoConfirmacion({
      mensaje: '¿Eliminar maleta y todos sus outfits?',
      accion: async () => {
        await supabase.from('maletas').delete().eq('id', id)
        const nuevasMaletas = maletas.filter(m => m.id !== id)
        setMaletas(nuevasMaletas)
        localStorage.setItem('cache_maletas', JSON.stringify(nuevasMaletas))
        setDialogoConfirmacion(null)
      }
    })
  }

  function solicitarEliminacionConjunto(id) {
    setDialogoConfirmacion({
      mensaje: '¿Eliminar outfit de la maleta?',
      accion: async () => {
        await supabase.from('conjuntos').delete().eq('id', id)
        const nuevosConjuntos = conjuntos.filter(c => c.id !== id)
        setConjuntos(nuevosConjuntos)
        localStorage.setItem(`cache_conjuntos_${maletaActiva.id}`, JSON.stringify(nuevosConjuntos))
        setDialogoConfirmacion(null)
      }
    })
  }

  function abrirMaleta(maleta) {
    setAbriendo(maleta.id)
    setTimeout(() => { setMaletaActiva(maleta); setAbriendo(null); }, 650)
  }

  async function actualizarEstado(conjuntoId, prendaId, x, y, z) {
    await supabase.from('conjunto_prenda').update({ pos_x: x, pos_y: y, z_index: z }).match({ conjunto_id: conjuntoId, prenda_id: prendaId })
  }

  const itemsFiltrados = !maletaActiva ? maletas.filter(m => m.nombre.toLowerCase().includes(busqueda.toLowerCase())) : conjuntos.filter(c => c.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  return (
    <div className="flex flex-col h-full w-full animate-fade-in-up relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 md:mb-8 gap-3 md:gap-4 border-b border-rose-100/50 in-[.modo-oscuro_&]:border-[#322F44]/50 pb-4 md:pb-6 w-full">
        {maletaActiva ? (
          <button onClick={() => setMaletaActiva(null)} className="font-bold text-slate-700 in-[.modo-oscuro_&]:text-[#E0D8F0] bg-white/60 in-[.modo-oscuro]:bg-[#2A273F]/60 px-4 md:px-5 py-2.5 md:py-3 rounded-xl md:rounded-2xl cursor-pointer shadow-sm active:scale-95 border border-rose-200/50 in-[.modo-oscuro_&]:border-[#433D60] text-sm md:text-base">← Cerrar</button>
        ) : (
          <h3 className="font-bold text-xl md:text-2xl text-transparent bg-clip-text bg-linear-to-rrom-teal-600 to-rose-400 in-[.modo-oscuro]:from-[#A394D6] in-[.modo-oscuro]:to-[#C2A3FF] hidden sm:block">Mis maletas</h3>
        )}

        <div className="flex w-full sm:w-auto gap-2 md:gap-4">
          <input 
            type="text" 
            autoComplete="off"
            placeholder={!maletaActiva ? "Buscar maleta..." : "Buscar conjunto..."} 
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="flex-1 border border-rose-200/50 in-[.modo-oscuro_&]:border-[#433D60] bg-white/80 in-[.modo-oscuro]:bg-[#2A273F]/80 text-slate-800 in-[.modo-oscuro_&]:text-[#E0D8F0] rounded-xl p-2.5 md:p-3 px-4 text-xs md:text-sm focus:ring-4 focus:ring-teal-400/30 in-[.modo-oscuro_&]:focus:ring-[#A394D6]/30 outline-none shadow-sm transition-all"
          />
          {!maletaActiva && (
            <button onClick={onCrearMaleta} className="bg-linear-to-r from-teal-400 to-emerald-400 in-[.modo-oscuro]:from-[#7E67C9] in-[.modo-oscuro]:to-[#9985D8] text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-bold shadow-lg cursor-pointer hover:scale-105 active:scale-95 text-xs md:text-base whitespace-nowrap">
              + Preparar
            </button>
          )}
        </div>
      </div>

      {maletaActiva && <h2 className="text-xl md:text-3xl font-extrabold text-center text-slate-800 in-[.modo-oscuro_&]:text-[#E0D8F0] mb-6 tracking-tight animate-pop-in">{maletaActiva.nombre}</h2>}

      {cargando ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 md:gap-4 px-1">
           {[...Array(6)].map((_, i) => <div key={i} className="rounded-xl md:rounded-3xl h-45 md:h-65 bg-white/50 in-[.modo-oscuro_&]:bg-[#2A273F]/50 animate-shimmer"></div>)}
        </div>
      ) : itemsFiltrados.length === 0 ? (
        <p className="text-center text-slate-400 in-[.modo-oscuro_&]:text-[#7A7593] py-10 border-2 border-dashed border-rose-200/50 in-[.modo-oscuro_&]:border-[#433D60]/50 rounded-2xl text-sm md:text-base">Vacío.</p>
      ) : !maletaActiva ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-y-12 md:gap-y-16 gap-x-2 md:gap-x-6 pt-8 md:pt-12 px-1">
          {itemsFiltrados.map((m) => (
            <div key={m.id} className="relative group flex flex-col items-center justify-end w-full animate-pop-in">
              <button onClick={(e) => solicitarEliminacionMaleta(m.id, e)} className="absolute -top-4 -right-1 md:-top-6 md:-right-2 z-50 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 bg-white in-[.modo-oscuro_&]:bg-[#2A273F] text-red-500 w-6 h-6 md:w-9 md:h-9 rounded-full font-bold flex items-center justify-center cursor-pointer shadow-lg border border-rose-100 in-[.modo-oscuro_&]:border-[#433D60] active:scale-90 transition-all text-[10px] md:text-base">✕</button>

              <div onClick={() => abrirMaleta(m)} className="relative w-full max-w-23.75 md:max-w-41.25 aspect-2/3 perspective-[2000px] cursor-pointer transition-transform duration-500 hover:scale-[1.03] mb-1 md:mb-4 mx-auto drop-shadow-xl">
                 <div className="absolute -top-3 md:-top-7 left-1/2 -translate-x-1/2 w-10 md:w-20 h-3 md:h-7 flex justify-between z-0">
                    <div className="w-0.75 md:w-2.5 h-full bg-linear-to-r from-slate-300 via-slate-100 to-slate-400 in-[.modo-oscuro_&]:from-[#3B3852] in-[.modo-oscuro_&]:via-[#494463] in-[.modo-oscuro_&]:to-[#2E2A44] border-x border-slate-400 in-[.modo-oscuro_&]:border-[#1F1D2B]"></div>
                    <div className="w-0.75 md:w-2.5 h-full bg-linear-to-r from-slate-300 via-slate-100 to-slate-400 in-[.modo-oscuro_&]:from-[#3B3852] in-[.modo-oscuro_&]:via-[#494463] in-[.modo-oscuro_&]:to-[#2E2A44] border-x border-slate-400 in-[.modo-oscuro_&]:border-[#1F1D2B]"></div>
                    <div className="absolute top-0 left-0 w-full h-1 md:h-3 bg-linear-to-b from-slate-200 to-slate-400 in-[.modo-oscuro_&]:from-[#494463] in-[.modo-oscuro_&]:to-[#2E2A44] rounded-t-sm shadow-sm border border-slate-400/50 in-[.modo-oscuro_&]:border-[#1F1D2B]"></div>
                 </div>

                 <div className="absolute -bottom-2 md:-bottom-4 left-1.5 md:left-3 w-3 md:w-5 h-3 md:h-6 bg-linear-to-b from-slate-300 to-slate-400 in-[.modo-oscuro_&]:from-[#3B3852] in-[.modo-oscuro_&]:to-[#1F1D2B] rounded-b-sm md:rounded-b-md z-0 flex flex-col items-center justify-end md:pb-0.5 shadow-md border-x border-slate-400/50 in-[.modo-oscuro_&]:border-[#13111C]">
                   <div className="w-3.5 md:w-6 h-1 md:h-3 bg-[#111] rounded-full border border-slate-300 in-[.modo-oscuro_&]:border-[#494463] flex items-center justify-center md:-mb-1 shadow-lg"></div>
                 </div>
                 <div className="absolute -bottom-2 md:-bottom-4 right-1.5 md:right-3 w-3 md:w-5 h-3 md:h-6 bg-linear-to-b from-slate-300 to-slate-400 in-[.modo-oscuro_&]:from-[#3B3852] in-[.modo-oscuro_&]:to-[#1F1D2B] rounded-b-sm md:rounded-b-md z-0 flex flex-col items-center justify-end md:pb-0.5 shadow-md border-x border-slate-400/50 in-[.modo-oscuro_&]:border-[#13111C]">
                   <div className="w-3.5 md:w-6 h-1 md:h-3 bg-[#111] rounded-full border border-slate-300 in-[.modo-oscuro_&]:border-[#494463] flex items-center justify-center md:-mb-1 shadow-lg"></div>
                 </div>
                 <div className="absolute top-0 left-0 w-full h-full bg-[#1e293b] in-[.modo-oscuro_&]:bg-[#13111C] rounded-lg md:rounded-[1.8rem] shadow-[inset_0_0_20px_rgba(0,0,0,1)] border border-slate-600 in-[.modo-oscuro_&]:border-[#494463] overflow-hidden z-10 flex flex-col justify-center">
                    <div className="absolute inset-1 md:inset-3 border border-slate-700/50 in-[.modo-oscuro]:border-[#494463]/30 rounded-md md:rounded-xl z-10 overflow-hidden pointer-events-none">
                       <div className="absolute top-1/2 left-1/2 w-[150%] h-0.5 md:h-3 bg-slate-800 in-[.modo-oscuro_&]:bg-[#1F1D2B] -translate-x-1/2 -translate-y-1/2 rotate-45 flex items-center justify-center"></div>
                       <div className="absolute top-1/2 left-1/2 w-[150%] h-0.5 md:h-3 bg-slate-800 in-[.modo-oscuro_&]:bg-[#1F1D2B] -translate-x-1/2 -translate-y-1/2 -rotate-45"></div>
                    </div>
                    
                    {m.conjuntos && m.conjuntos.length > 0 && (
                       <div className={`absolute bottom-2 md:bottom-5 w-[75%] left-[12.5%] flex flex-col justify-end z-20 transition-all duration-800 delay-75 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${abriendo === m.id ? 'translate-x-0 opacity-100 scale-100' : '-translate-x-4 md:-translate-x-8 opacity-0 scale-90'}`}>
                           <div className="w-[75%] h-2.5 md:h-4 bg-linear-to-b from-rose-500 to-rose-700 in-[.modo-oscuro_&]:from-[#A394D6] in-[.modo-oscuro_&]:to-[#7E67C9] rounded-sm border-t border-rose-400 in-[.modo-oscuro_&]:border-[#C2A3FF] shadow-[0_2px_4px_rgba(0,0,0,0.6)] mx-auto rotate-3 -mb-0.5 md:-mb-1"></div>
                           <div className="w-[90%] h-2.5 md:h-4 bg-linear-to-b from-slate-20 to-slate-40 in-[.modo-oscuro_&]:from=[#494463] in-[.modo-oscuro_&]:to=[#2E2A44] rounded-sm border-t border-white/80 in-[.modo-oscuro_&]:border=[#7A7593] shadow=[0_2px_4px_rgba(0,0,0,0.6)] mx-auto -rotate-2 -mb-0.5 md:-mb-1"></div>
                           <div className="w-full h-3.5 md:h-6 bg-linear-to-b from-teal-600 to-teal-800 in-[.modo-oscuro_&]:from-[#7E67C9] in-[.modo-oscuro_&]:to-[#433D60] rounded-sm border-t border-teal-400 in-[.modo-oscuro_&]:border-[#A394D6] shadow-[0_4px_8px_rgba(0,0,0,0.8)] mx-auto"></div>
                       </div>
                    )}
                 </div>

                 <div className={`absolute top-0 left-0 w-full h-full rounded-lg md:rounded-[1.8rem] origin-left transition-transform duration-800 ease-[cubic-bezier(0.25,1,0.5,1)] z-30 shadow-[3px_0_10px_rgba(0,0,0,0.4)] transform-3d ${abriendo === m.id ? 'transform-[rotateY(-105deg)_translateX(-2px)]' : ''}`}>
                    <div className="absolute inset-0 bg-linear-to-br from-[#f8fafc] via-[#cbd5e1] to-[#94a3b8] in-[.modo-oscuro_&]:from-[#494463] in-[.modo-oscuro_&]:via-[#3B3852] in-[.modo-oscuro_&]:to-[#2A273F] rounded-lg md:rounded-[1.8rem] border border-white/60 in-[.modo-oscuro_&]:border-[#7A7593]/40 overflow-hidden">
                      <div className="absolute inset-0 flex justify-evenly px-0.5 md:px-2 py-1 md:py-4">
                          {[...Array(7)].map((_, i) => <div key={i} className="w-[1.5px] md:w-1.75 h-full bg-linear-to-r from-black/5 via-transparent to-white/6₀ in-[.modo-oscuro_&]:from-black/4₀ in-[.modo-oscuro_&]:via-transparent in-[.modo-oscuro_&]:to-white/1₀ rounded-full shadow-[1px_₀_2px_rgba(₀,₀,₀,₀.₁)]"></div>)}
                      </div>
                      <div className="absolute top-1.5 md:top-6 left-1/2 -translate-x-1/2 w-4 md:w-10 h-0.75 md:h-2.5 bg-linear-to-b from-slate-200 to-slate-400 in-[.modo-oscuro_&]:from-[#7A7593] in-[.modo-oscuro_&]:to-[#2E2A44] rounded-sm shadow-sm border border-slate-500/40 in-[.modo-oscuro_&]:border-[#1F1D2B]"></div>
                    </div>
                 </div>
              </div>

              <p className="mt-1 md:mt-4 font-bold text-slate-800 in-[.modo-oscuro_&]:text-[#E0D8F0] text-center text-[10px] md:text-lg px-0.5 w-full truncate tracking-wide leading-tight">{m.nombre}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-2 w-full">
          {itemsFiltrados.map((conj, i) => (
            <div key={conj.id} className="relative border border-white/50 in-[.modo-oscuro_&]:border-[#322F44]/50 p-6 rounded-4xl bg-white/50 in-[.modo-oscuro_&]:bg-[#1F1D2B]/50 backdrop-blur-md shadow-lg group animate-fade-in-up w-full flex flex-col">
              <button onClick={() => solicitarEliminacionConjunto(conj.id)} className="absolute top-5 right-5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 bg-white in-[.modo-oscuro_&]:bg-[#2A273F] text-red-500 w-9 h-9 rounded-full font-bold flex items-center justify-center cursor-pointer shadow-md border border-rose-100 in-[.modo-oscuro_&]:border-[#433D60] active:scale-90 z-50 transition-all">✕</button>
              
              <h3 className="font-extrabold text-xl mb-4 text-slate-800 in-[.modo-oscuro_&]:text-[#E0D8F0] pl-1 pr-8 truncate">{conj.nombre}</h3>
              
              <div className="relative w-full h-112.5 md:h-150 bg-rose-50/30 in-[.modo-oscuro_&]:bg-[#13111C]/40 rounded-3xl border-2 border-dashed border-rose-200 in-[.modo-oscuro_&]:border-[#433D60] overflow-hidden shadow-inner touch-none">
                {conj.conjunto_prenda.map((cp, idx) => (
                  <PrendaArrastrable key={cp.prendas.id} cp={cp} index={idx} maxZ={maxZ} setMaxZ={setMaxZ} onGuardarEstado={actualizarEstado} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {dialogoConfirmacion && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-100 p-4 backdrop-blur-sm animate-fade-in-up">
          <div className="bg-white in-[.modo-oscuro_&]:bg-[#1F1D2B] border border-rose-100 in-[.modo-oscuro_&]:border-[#433D60] rounded-2xl shadow-2xl p-5 max-w-sm w-full text-center">
            <h3 className="text-lg font-bold text-slate-800 in-[.modo-oscuro_&]:text-[#E0D8F0] mb-5">{dialogoConfirmacion.mensaje}</h3>
            <div className="flex gap-3 justify-center">
              <button onClick={dialogoConfirmacion.accion} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 px-4 rounded-xl flex-1 cursor-pointer active:scale-95 transition-transform text-sm">Eliminar</button>
              <button onClick={() => setDialogoConfirmacion(null)} className="bg-slate-100 in-[.modo-oscuro_&]:bg-[#2A273F] hover:bg-slate-200 in-[.modo-oscuro_&]:hover:bg-[#34304D] text-slate-800 in-[.modo-oscuro_&]:text-[#E0D8F0] font-bold py-2.5 px-4 rounded-xl flex-1 cursor-pointer active:scale-95 transition-transform text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}