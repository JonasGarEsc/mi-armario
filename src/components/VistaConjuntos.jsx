import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

function PrendaArrastrable({ cp, index, maxZ, setMaxZ, onGuardarEstado }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const [pos, setPos] = useState({ 
    x: cp.pos_x ?? (isMobile ? 10 : 40), 
    y: cp.pos_y ?? (index * (isMobile ? 70 : 90) + 10) 
  })
  const [zIndex, setZIndex] = useState(cp.z_index ?? 10)
  const [isDragging, setIsDragging] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

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

    const itemSize = window.innerWidth >= 768 ? 128 : 96
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
    onGuardarEstado(cp.conjunto_id, cp.prenda_id, pos.x, pos.y, zIndex)
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, touchAction: 'none', zIndex: isDragging ? maxZ + 2 : zIndex }}
      className={`absolute w-24 h-24 md:w-32 md:h-32 flex items-center justify-center select-none [-webkit-tap-highlight-color:transparent] ${isDragging ? 'scale-110 cursor-grabbing' : 'transition-transform cursor-grab active:scale-105'}`}
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
      setCargando(true)
      if (!maletaActiva) {
        const { data } = await supabase.from('maletas').select('*, conjuntos(id)').order('nombre')
        if (data) setMaletas(data)
      } else {
        const { data } = await supabase.from('conjuntos').select('id, nombre, conjunto_prenda ( conjunto_id, prenda_id, pos_x, pos_y, z_index, prendas ( id, imagen_url, categorias ( nombre ) ) )').eq('maleta_id', maletaActiva.id).order('nombre')
        if (data) setConjuntos(data)
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
        setMaletas(maletas.filter(m => m.id !== id))
        setDialogoConfirmacion(null)
      }
    })
  }

  function solicitarEliminacionConjunto(id) {
    setDialogoConfirmacion({
      mensaje: '¿Eliminar outfit de la maleta?',
      accion: async () => {
        await supabase.from('conjuntos').delete().eq('id', id)
        setConjuntos(conjuntos.filter(c => c.id !== id))
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 md:mb-8 gap-3 md:gap-4 border-b border-rose-100/50 pb-4 md:pb-6 w-full">
        {maletaActiva ? (
          <button onClick={() => setMaletaActiva(null)} className="font-bold text-slate-700 bg-white/60 px-4 md:px-5 py-2.5 md:py-3 rounded-xl md:rounded-2xl cursor-pointer shadow-sm active:scale-95 border border-rose-200/50 text-sm md:text-base">← Cerrar</button>
        ) : (
          <h3 className="font-bold text-xl md:text-2xl text-transparent bg-clip-text bg-linear-to-r from-teal-600 to-rose-400 hidden sm:block">Mis maletas</h3>
        )}

        <div className="flex w-full sm:w-auto gap-2 md:gap-4">
          <input 
            type="text" 
            autoComplete="off"
            placeholder={!maletaActiva ? "Buscar maleta..." : "Buscar conjunto..."} 
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="flex-1 border border-rose-200/50 bg-white/80 text-slate-800 rounded-xl p-2.5 md:p-3 px-4 text-xs md:text-sm focus:ring-4 focus:ring-teal-400/30 outline-none shadow-sm transition-all"
          />
          {!maletaActiva && (
            <button onClick={onCrearMaleta} className="bg-linear-to-r from-teal-400 to-emerald-400 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-bold shadow-lg cursor-pointer hover:scale-105 active:scale-95 text-xs md:text-base whitespace-nowrap">
              + Preparar
            </button>
          )}
        </div>
      </div>

      {maletaActiva && <h2 className="text-xl md:text-3xl font-extrabold text-center text-slate-800 mb-6 tracking-tight animate-pop-in">{maletaActiva.nombre}</h2>}

      {cargando ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 md:gap-4 px-1">
           {[...Array(6)].map((_, i) => <div key={i} className="rounded-xl h-32 md:h-64 bg-white/50 animate-shimmer"></div>)}
        </div>
      ) : itemsFiltrados.length === 0 ? (
        <p className="text-center text-slate-400 py-10 border-2 border-dashed border-rose-200/50 rounded-2xl text-sm md:text-base">Vacío.</p>
      ) : !maletaActiva ? (
        /* MALETAS: 3 columnas en móvil */
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-y-12 md:gap-y-16 gap-x-2 md:gap-x-6 pt-8 md:pt-12 px-1">
          {itemsFiltrados.map((m) => (
            <div key={m.id} className="relative group flex flex-col items-center justify-end w-full animate-pop-in">
              <button onClick={(e) => solicitarEliminacionMaleta(m.id, e)} className="absolute -top-4 -right-1 md:-top-6 md:-right-2 z-50 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 bg-white text-red-500 w-6 h-6 md:w-9 md:h-9 rounded-full font-bold flex items-center justify-center cursor-pointer shadow-lg border border-rose-100 active:scale-90 transition-all text-[10px] md:text-base">✕</button>

              <div onClick={() => abrirMaleta(m)} className="relative w-full max-w-23.75 md:max-w-41.25 aspect-2/3 perspective-[2000px] cursor-pointer transition-transform duration-500 hover:scale-[1.03] mb-1 md:mb-4 mx-auto drop-shadow-xl">
                 <div className="absolute -top-3 md:-top-7 left-1/2 -translate-x-1/2 w-10 md:w-20 h-3 md:h-7 flex justify-between z-0">
                    <div className="w-0.75 md:w-2.5 h-full bg-linear-to-r from-slate-300 via-slate-100 to-slate-400 border-x border-slate-400"></div>
                    <div className="w-0.75 md:w-2.5 h-full bg-linear-to-r from-slate-300 via-slate-100 to-slate-400 border-x border-slate-400"></div>
                    <div className="absolute top-0 left-0 w-full h-1 md:h-3 bg-linear-to-b from-slate-200 to-slate-400 rounded-t-sm shadow-sm border border-slate-400/50"></div>
                 </div>

                 <div className="absolute -bottom-2 md:-bottom-4 left-1.5 md:left-3 w-3 md:w-5 h-3 md:h-6 bg-linear-to-b from-slate-300 to-slate-400 rounded-b-sm md:rounded-b-md z-0 flex flex-col items-center justify-end md:pb-0.5 shadow-md border-x border-slate-400/50">
                   <div className="w-3.5 md:w-6 h-1 md:h-3 bg-[#111] rounded-full border border-slate-300 flex items-center justify-center md:-mb-1 shadow-lg"></div>
                 </div>
                 <div className="absolute -bottom-2 md:-bottom-4 right-1.5 md:right-3 w-3 md:w-5 h-3 md:h-6 bg-linear-to-b from-slate-300 to-slate-400 rounded-b-sm md:rounded-b-md z-0 flex flex-col items-center justify-end md:pb-0.5 shadow-md border-x border-slate-400/50">
                   <div className="w-3.5 md:w-6 h-1 md:h-3 bg-[#111] rounded-full border border-slate-300 flex items-center justify-center md:-mb-1 shadow-lg"></div>
                 </div>

                 <div className="absolute top-0 left-0 w-full h-full bg-[#1e293b] rounded-lg md:rounded-[1.8rem] shadow-[inset_0_0_20px_rgba(0,0,0,1)] border border-slate-600 overflow-hidden z-10 flex flex-col justify-center">
                    <div className="absolute inset-1 md:inset-3 border border-slate-700/50 rounded-md md:rounded-xl z-10 overflow-hidden pointer-events-none">
                       <div className="absolute top-1/2 left-1/2 w-[150%] h-0.5 md:h-3 bg-slate-800 -translate-x-1/2 -translate-y-1/2 rotate-45 flex items-center justify-center"></div>
                       <div className="absolute top-1/2 left-1/2 w-[150%] h-0.5 md:h-3 bg-slate-800 -translate-x-1/2 -translate-y-1/2 -rotate-45"></div>
                    </div>
                    
                    {m.conjuntos && m.conjuntos.length > 0 && (
                       <div className={`absolute bottom-2 md:bottom-5 w-[75%] left-[12.5%] flex flex-col justify-end z-20 transition-all duration-800 delay-75 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${abriendo === m.id ? 'translate-x-0 opacity-100 scale-100' : '-translate-x-4 md:-translate-x-8 opacity-0 scale-90'}`}>
                           <div className="w-[75%] h-2.5 md:h-4 bg-linear-to-b from-rose-500 to-rose-700 rounded-sm border-t border-rose-400 shadow-[0_2px_4px_rgba(0,0,0,0.6)] mx-auto rotate-3 -mb-0.5 md:-mb-1"></div>
                           <div className="w-[90%] h-2.5 md:h-4 bg-linear-to-b from-slate-200 to-slate-400 rounded-sm border-t border-white/80 shadow-[0_2px_4px_rgba(0,0,0,0.6)] mx-auto -rotate-2 -mb-0.5 md:-mb-1"></div>
                           <div className="w-full h-3.5 md:h-6 bg-linear-to-b from-teal-600 to-teal-800 rounded-sm border-t border-teal-400 shadow-[0_4px_8px_rgba(0,0,0,0.8)] mx-auto"></div>
                       </div>
                    )}
                 </div>

                 <div className={`absolute top-0 left-0 w-full h-full rounded-lg md:rounded-[1.8rem] origin-left transition-transform duration-800 ease-[cubic-bezier(0.25,1,0.5,1)] z-30 shadow-[3px_0_10px_rgba(0,0,0,0.4)] transform-3d ${abriendo === m.id ? 'transform-[rotateY(-105deg)_translateX(-2px)]' : ''}`}>
                    <div className="absolute inset-0 bg-linear-to-br from-[#f8fafc] via-[#cbd5e1] to-[#94a3b8] rounded-lg md:rounded-[1.8rem] border border-white/60 overflow-hidden">
                      <div className="absolute inset-0 flex justify-evenly px-0.5 md:px-2 py-1 md:py-4">
                          {[...Array(7)].map((_, i) => <div key={i} className="w-[1.5px] md:w-1.75 h-full bg-linear-to-r from-black/5 via-transparent to-white/60 rounded-full shadow-[1px_0_2px_rgba(0,0,0,0.1)]"></div>)}
                      </div>
                      <div className="absolute top-1.5 md:top-6 left-1/2 -translate-x-1/2 w-4 md:w-10 h-0.75 md:h-2.5 bg-linear-to-b from-slate-200 to-slate-400 rounded-sm shadow-sm border border-slate-500/40"></div>
                    </div>
                 </div>
              </div>

              <p className="mt-1 md:mt-4 font-bold text-slate-800 text-center text-[10px] md:text-lg px-0.5 w-full truncate tracking-wide leading-tight">{m.nombre}</p>
            </div>
          ))}
        </div>
      ) : (
        /* OUTFITS: 2 columnas */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 px-1 w-full">
          {itemsFiltrados.map((conj, i) => (
            <div key={conj.id} className="relative border border-white/50 p-2 md:p-6 rounded-xl md:rounded-4xl bg-white/50 backdrop-blur-md shadow-lg group animate-fade-in-up w-full flex flex-col">
              <button onClick={() => solicitarEliminacionConjunto(conj.id)} className="absolute top-1.5 right-1.5 md:top-5 md:right-5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 bg-white text-red-500 w-6 h-6 md:w-9 md:h-9 rounded-full font-bold flex items-center justify-center cursor-pointer shadow-md active:scale-90 z-50 text-[10px] md:text-base">✕</button>
              
              <h3 className="font-extrabold text-xs md:text-xl mb-2 md:mb-4 text-slate-800 pl-1 truncate w-[85%]">{conj.nombre}</h3>
              
              <div className="relative w-full h-80 md:h-150 bg-rose-50/30 rounded-lg md:rounded-3xl border-2 border-dashed border-rose-200 overflow-hidden shadow-inner touch-none">
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
          <div className="bg-white border border-rose-100 rounded-2xl shadow-2xl p-4 md:p-5 max-w-sm w-full text-center">
            <h3 className="text-sm md:text-lg font-bold text-slate-800 mb-5">{dialogoConfirmacion.mensaje}</h3>
            <div className="flex gap-2 md:gap-3 justify-center">
              <button onClick={dialogoConfirmacion.accion} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 md:py-2.5 px-3 md:px-4 rounded-lg md:rounded-xl flex-1 cursor-pointer active:scale-95 transition-transform text-xs md:text-sm">Eliminar</button>
              <button onClick={() => setDialogoConfirmacion(null)} className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 md:py-2.5 px-3 md:px-4 rounded-lg md:rounded-xl flex-1 cursor-pointer active:scale-95 transition-transform text-xs md:text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}