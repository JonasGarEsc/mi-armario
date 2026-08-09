import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

// Motor de físicas rediseñado con límites estrictos y jerarquía Z
function PrendaArrastrable({ cp, index, maxZ, setMaxZ, onGuardarEstado }) {
  const [pos, setPos] = useState({ 
    x: cp.pos_x ?? 80, 
    y: cp.pos_y ?? (index * 120 + 20) 
  })
  const [zIndex, setZIndex] = useState(cp.z_index ?? 10)
  const [isDragging, setIsDragging] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const handlePointerDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
    
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

    const itemSize = 128
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
      className={`absolute w-32 h-32 flex items-center justify-center select-none [-webkit-tap-highlight-color:transparent] ${isDragging ? 'scale-110 cursor-grabbing' : 'transition-transform cursor-grab active:scale-105'}`}
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
  
  // Estado global para controlar la profundidad en el lienzo actual
  const [maxZ, setMaxZ] = useState(100)

  useEffect(() => {
    async function cargarDatos() {
      setCargando(true)
      if (!maletaActiva) {
        const { data } = await supabase.from('maletas').select('*, conjuntos(id)').order('nombre')
        if (data) setMaletas(data)
      } else {
        const { data } = await supabase
          .from('conjuntos')
          .select('id, nombre, conjunto_prenda ( conjunto_id, prenda_id, pos_x, pos_y, z_index, prendas ( id, imagen_url, categorias ( nombre ) ) )')
          .eq('maleta_id', maletaActiva.id)
          .order('nombre')
        if (data) setConjuntos(data)
      }
      setCargando(false)
    }
    cargarDatos()
  }, [maletaActiva])

  function solicitarEliminacionMaleta(id, e) {
    e.stopPropagation()
    setDialogoConfirmacion({
      mensaje: '¿Estás segura de eliminar esta maleta y todos sus outfits?',
      accion: async () => {
        await supabase.from('maletas').delete().eq('id', id)
        setMaletas(maletas.filter(m => m.id !== id))
        setDialogoConfirmacion(null)
      }
    })
  }

  function solicitarEliminacionConjunto(id) {
    setDialogoConfirmacion({
      mensaje: '¿Estás segura de eliminar este outfit de la maleta?',
      accion: async () => {
        await supabase.from('conjuntos').delete().eq('id', id)
        setConjuntos(conjuntos.filter(c => c.id !== id))
        setDialogoConfirmacion(null)
      }
    })
  }

  function abrirMaleta(maleta) {
    setAbriendo(maleta.id)
    setTimeout(() => {
      setMaletaActiva(maleta)
      setAbriendo(null)
    }, 650)
  }

  async function actualizarEstado(conjuntoId, prendaId, x, y, z) {
    await supabase
      .from('conjunto_prenda')
      .update({ pos_x: x, pos_y: y, z_index: z })
      .match({ conjunto_id: conjuntoId, prenda_id: prendaId })
  }

  const itemsFiltrados = !maletaActiva 
    ? maletas.filter(m => m.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : conjuntos.filter(c => c.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  return (
    <div className="flex flex-col h-full w-full animate-fade-in-up relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 border-b border-rose-100/50 in-[.modo-oscuro]:border-slate-700/50 pb-6 w-full">
        
        {maletaActiva ? (
          <button onClick={() => setMaletaActiva(null)} className="font-bold text-slate-700 in-[.modo-oscuro_&]:text-slate-200 bg-white/60 in-[.modo-oscuro_&]:bg-slate-700/50 px-5 py-3 rounded-2xl cursor-pointer shadow-sm active:scale-95 transition-transform border border-rose-200/50 in-[.modo-oscuro_&]:border-slate-600">
            ← Cerrar Maleta
          </button>
        ) : (
          <h3 className="font-bold text-2xl text-transparent bg-clip-text bg-linear-to-r from-teal-600 to-rose-400 in-[.modo-oscuro_&]:from-indigo-300 in-[.modo-oscuro_&]:to-purple-300 hidden sm:block">Mis Viajes</h3>
        )}

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <input 
            type="text" 
            placeholder={!maletaActiva ? "Buscar maleta..." : "Buscar conjunto..."} 
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="flex-1 border border-rose-200/50 in-[.modo-oscuro_&]:border-slate-600 bg-white/80 in-[.modo-oscuro_&]:bg-slate-700/80 text-slate-800 in-[.modo-oscuro_&]:text-slate-100 rounded-2xl p-3 px-5 text-sm focus:ring-4 focus:ring-teal-400/30 outline-none shadow-sm transition-all"
          />
          {!maletaActiva && (
            <button onClick={onCrearMaleta} className="bg-linear-to-r from-teal-400 to-emerald-400 in-[.modo-oscuro_&]:from-indigo-500 in-[.modo-oscuro_&]:to-purple-500 text-white px-6 py-3 rounded-2xl font-bold shadow-lg cursor-pointer hover:scale-105 hover:opacity-90 active:scale-95 transition-all border border-white/20">
              + Preparar Maleta
            </button>
          )}
        </div>
      </div>

      {maletaActiva && (
        <h2 className="text-3xl font-extrabold text-center text-slate-800 in-[.modo-oscuro_&]:text-indigo-200 mb-8 tracking-tight animate-pop-in">
          {maletaActiva.nombre}
        </h2>
      )}

      {cargando ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-2">
           {[...Array(4)].map((_, i) => <div key={i} className="rounded-3xl h-64 bg-white/50 in-[.modo-oscuro_&]:bg-slate-700/50 animate-shimmer"></div>)}
        </div>
      ) : itemsFiltrados.length === 0 ? (
        <p className="text-center text-slate-400 py-10 border-2 border-dashed border-rose-200/50 rounded-3xl bg-white/30">Vacío.</p>
      ) : !maletaActiva ? (
        
       <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-y-20 gap-x-6 pt-12 px-2">
          {itemsFiltrados.map((m) => (
            <div key={m.id} className="relative group flex flex-col items-center justify-end w-full animate-pop-in">
              <button onClick={(e) => solicitarEliminacionMaleta(m.id, e)} className="absolute -top-6 -right-2 z-50 opacity-0 group-hover:opacity-100 bg-white text-red-500 w-9 h-9 rounded-full font-bold flex items-center justify-center cursor-pointer shadow-lg border border-rose-100 active:scale-90 transition-all">✕</button>

              {/* CONTENEDOR MALETA FOTORREALISTA */}
              <div onClick={() => abrirMaleta(m)} className="relative w-full max-w-41.25 aspect-2/3 perspective-[2000px] cursor-pointer transition-transform duration-500 hover:scale-[1.03] mb-4 mx-auto drop-shadow-2xl">
                 
                 {/* Asa telescópica (Parte trasera) */}
                 <div className="absolute -top-7 left-1/2 -translate-x-1/2 w-20 h-7 flex justify-between z-0">
                    <div className="w-2.5 h-full bg-linear-to-r from-slate-300 via-slate-100 to-slate-400 in-[.modo-oscuro_&]:from-slate-600 in-[.modo-oscuro_&]:to-slate-700 border-x border-slate-400"></div>
                    <div className="w-2.5 h-full bg-linear-to-r from-slate-300 via-slate-100 to-slate-400 in-[.modo-oscuro_&]:from-slate-600 in-[.modo-oscuro_&]:to-slate-700 border-x border-slate-400"></div>
                    <div className="absolute top-0 left-0 w-full h-3 bg-linear-to-b from-slate-200 to-slate-400 in-[.modo-oscuro_&]:from-slate-500 in-[.modo-oscuro_&]:to-slate-700 rounded-t-sm shadow-sm border border-slate-400/50"></div>
                 </div>

                 {/* Ruedas Spinner 360 (Realistas) */}
                 <div className="absolute -bottom-4 left-3 w-5 h-6 bg-linear-to-b from-slate-300 to-slate-400 in-[.modo-oscuro_&]:from-slate-600 in-[.modo-oscuro_&]:to-slate-800 rounded-b-md z-0 flex flex-col items-center justify-end pb-0.5 shadow-md border-x border-slate-400/50">
                   <div className="w-6 h-3 bg-[#111] rounded-full border-[1.5px] border-slate-300 flex items-center justify-center -mb-1 shadow-lg">
                      <div className="w-1.5 h-1.5 bg-slate-300 rounded-full"></div>
                   </div>
                 </div>
                 <div className="absolute -bottom-4 right-3 w-5 h-6 bg-linear-to-b from-slate-300 to-slate-400 in-[.modo-oscuro_&]:from-slate-600 in-[.modo-oscuro_&]:to-slate-800 rounded-b-md z-0 flex flex-col items-center justify-end pb-0.5 shadow-md border-x border-slate-400/50">
                   <div className="w-6 h-3 bg-[#111] rounded-full border-[1.5px] border-slate-300 flex items-center justify-center -mb-1 shadow-lg">
                      <div className="w-1.5 h-1.5 bg-slate-300 rounded-full"></div>
                   </div>
                 </div>

                 {/* INTERIOR DE LA MALETA (Forro y Correas) */}
                 <div className="top-0 left-0 w-full h-full bg-[#1e293b] rounded-[1.8rem] shadow-[inset_0_0_40px_rgba(0,0,0,1)] border border-slate-600 overflow-hidden z-10 flex flex-col justify-center relative">
                    {/* Textura de tela interior */}
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), repeating-linear-gradient(45deg, #000 25%, #1e293b 25%, #1e293b 75%, #000 75%, #000)', backgroundPosition: '0 0, 4px 4px', backgroundSize: '8px 8px' }}></div>
                    
                    {/* Correas de compresión (Forma de X) */}
                    <div className="absolute inset-3 border border-slate-700/50 rounded-xl z-10 overflow-hidden pointer-events-none">
                       <div className="absolute top-1/2 left-1/2 w-[150%] h-3 bg-slate-800 -translate-x-1/2 -translate-y-1/2 rotate-45 shadow-sm flex items-center justify-center">
                          <div className="w-6 h-4 bg-slate-900 border border-slate-600 rounded-sm"></div>
                       </div>
                       <div className="absolute top-1/2 left-1/2 w-[150%] h-3 bg-slate-800 -translate-x-1/2 -translate-y-1/2 -rotate-45 shadow-sm"></div>
                    </div>

                    {/* Ropa interior (Aparece fluidamente) */}
                    {m.conjuntos && m.conjuntos.length > 0 && (
                       <div className={`w-[85%] mx-auto transition-all duration-800 delay-100 flex flex-col items-center justify-end z-20 pb-4 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${abriendo === m.id ? 'translate-x-0 opacity-100 scale-100' : '-translate-x-10 opacity-0 scale-95'}`}>
                           <div className="w-[80%] h-5 bg-linear-to-r from-rose-500 to-rose-400 rounded-md border-t border-white/30 -mb-1 shadow-[0_2px_4px_rgba(0,0,0,0.5)] rotate-2"></div>
                           <div className="w-[90%] h-6 bg-linear-to-r from-slate-300 to-slate-200 rounded-md border-t border-white/50 -mb-1 shadow-[0_2px_4px_rgba(0,0,0,0.5)] -rotate-1"></div>
                           <div className="w-[95%] h-8 bg-linear-to-r from-teal-700 to-teal-500 rounded-md border-t border-white/20 shadow-[0_4px_8px_rgba(0,0,0,0.6)] relative overflow-hidden">
                             <div className="absolute top-0 right-4 w-2 h-full bg-teal-800/40"></div>
                           </div>
                       </div>
                    )}
                 </div>

                 {/* TAPA EXTERIOR METÁLICA (Animación física fluida) */}
                 <div className={`absolute top-0 left-0 w-full h-full rounded-[1.8rem] origin-left transition-transform duration-800 ease-[cubic-bezier(0.25,1,0.5,1)] z-30 shadow-[5px_0_20px_rgba(0,0,0,0.5)] transform-3d ${abriendo === m.id ? 'transform-[rotateY(-105deg)_translateX(-5px)]' : ''}`}>
                    
                    {/* Base de aluminio cepillado */}
                    <div className="absolute inset-0 bg-linear-to-br from-[#f8fafc] via-[#cbd5e1] to-[#94a3b8] in-[.modo-oscuro]:from-[#64748b] in-[.modo-oscuro_&]:via-[#475569] in-[.modo-oscuro_&]:to-[#334155] rounded-[1.8rem] border-[1.5px] border-white/60 in-[.modo-oscuro_&]:border-slate-400/30 overflow-hidden">
                      
                      {/* Reflejo de luz central */}
                      <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/40 to-transparent w-[200%] -translate-x-1/2"></div>
                      
                      {/* Estrías verticales extruidas */}
                      <div className="absolute inset-0 flex justify-evenly px-2 py-4">
                          {[...Array(7)].map((_, i) => (
                            <div key={i} className="w-1.75 h-full bg-linear-to-r from-black/5 via-transparent to-white/60 in-[.modo-oscuro_&]:from-black/40 in-[.modo-oscuro_&]:to-white/10 rounded-full shadow-[1px_0_2px_rgba(0,0,0,0.1)]"></div>
                          ))}
                      </div>

                      {/* Candados laterales TSA (Fotorrealistas) */}
                      <div className="absolute top-[25%] -right-0.5 w-1.5 h-6 bg-linear-to-l from-slate-200 to-slate-400 border border-slate-500/50 rounded-l-sm shadow-sm"></div>
                      <div className="absolute bottom-[25%] -right-0.5 w-1.5 h-6 bg-linear-to-l from-slate-200 to-slate-400 border border-slate-500/50 rounded-l-sm shadow-sm"></div>
                      <div className="absolute top-[50%] -translate-y-1/2 -left-0.5 w-1 h-12 bg-slate-300 rounded-r-sm opacity-60"></div>
                      
                      {/* Chapa central de la marca */}
                      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-10 h-2.5 bg-linear-to-b from-slate-200 to-slate-400 rounded-sm shadow-sm border border-slate-500/40 flex items-center justify-between px-1">
                         <div className="w-0.5 h-0.5 bg-slate-600 rounded-full"></div>
                         <div className="w-0.5 h-0.5 bg-slate-600 rounded-full"></div>
                      </div>
                    </div>

                    {/* Protectores de esquinas remachados (Metal pulido) */}
                    <div className="absolute top-0 left-0 w-8 h-8 bg-linear-to-br from-white to-slate-300 in-[.modo-oscuro_&]:from-slate-400 in-[.modo-oscuro_&]:to-slate-600 rounded-tl-[1.8rem] rounded-br-2xl shadow-[inset_-1px_-1px_3px_rgba(0,0,0,0.1),1px_1px_3px_rgba(0,0,0,0.2)] border-b border-r border-slate-400 flex items-center justify-center pb-2 pr-2">
                       <div className="w-1.5 h-1.5 bg-slate-200 rounded-full shadow-inner border border-slate-300"></div>
                    </div>
                    <div className="absolute top-0 right-0 w-8 h-8 bg-linear-to-bl from-white to-slate-300 in-[.modo-oscuro_&]:from-slate-400 in-[.modo-oscuro_&]:to-slate-600 rounded-tr-[1.8rem] rounded-bl-2xl shadow-[inset_1px_-1px_3px_rgba(0,0,0,0.1),-1px_1px_3px_rgba(0,0,0,0.2)] border-b border-l border-slate-400 flex items-center justify-center pb-2 pl-2">
                       <div className="w-1.5 h-1.5 bg-slate-200 rounded-full shadow-inner border border-slate-300"></div>
                    </div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 bg-linear-to-tr from-slate-200 to-slate-400 in-[.modo-oscuro_&]:from-slate-500 in-[.modo-oscuro_&]:to-slate-700 rounded-bl-[1.8rem] rounded-tr-2xl shadow-[inset_-1px_1px_3px_rgba(0,0,0,0.1),1px_-1px_3px_rgba(0,0,0,0.2)] border-t border-r border-slate-400 flex items-center justify-center pt-2 pr-2">
                       <div className="w-1.5 h-1.5 bg-slate-300 rounded-full shadow-inner border border-slate-400"></div>
                    </div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 bg-linear-to-tl from-slate-200 to-slate-400 in-[.modo-oscuro_&]:from-slate-500 in-[.modo-oscuro_&]:to-slate-700 rounded-br-[1.8rem] rounded-tl-2xl shadow-[inset_1px_1px_3px_rgba(0,0,0,0.1),-1px_-1px_3px_rgba(0,0,0,0.2)] border-t border-l border-slate-400 flex items-center justify-center pt-2 pl-2">
                       <div className="w-1.5 h-1.5 bg-slate-300 rounded-full shadow-inner border border-slate-400"></div>
                    </div>

                 </div>
              </div>

              <p className="mt-4 font-bold text-slate-800 in-[.modo-oscuro_&]:text-slate-100 text-center text-lg px-2 w-full truncate tracking-wide">{m.nombre}</p>
            </div>
          ))}
        </div>

      ) : (
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-2 w-full">
          {itemsFiltrados.map((conj, i) => (
            <div key={conj.id} className="relative border border-white/50 in-[.modo-oscuro_&]:border-slate-700 p-6 rounded-4xl bg-white/50 backdrop-blur-md in-[.modo-oscuro_&]:bg-slate-800/50 shadow-lg shadow-rose-100/30 group animate-fade-in-up w-full">
              
              <button onClick={() => solicitarEliminacionConjunto(conj.id)} className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 bg-white in-[.modo-oscuro_&]:bg-slate-700 text-red-500 w-9 h-9 rounded-full font-bold flex items-center justify-center cursor-pointer shadow-md active:scale-90 z-50 transition-all">✕</button>
              
              <h3 className="font-extrabold text-xl mb-4 text-slate-800 in-[.modo-oscuro_&]:text-slate-100 pl-2">{conj.nombre}</h3>
              
              <div className="relative w-full h-150 bg-rose-50/30 in-[.modo-oscuro_&]:bg-slate-900/40 rounded-3xl border-2 border-dashed border-rose-200 in-[.modo-oscuro_&]:border-slate-700 overflow-hidden shadow-inner touch-none">
                <span className="absolute bottom-3 right-4 text-xs font-bold text-slate-400 opacity-50 uppercase tracking-widest select-none pointer-events-none">Lienzo Vertical</span>
                
                {conj.conjunto_prenda.map((cp, idx) => (
                  <PrendaArrastrable 
                    key={cp.prendas.id} 
                    cp={cp} 
                    index={idx} 
                    maxZ={maxZ}
                    setMaxZ={setMaxZ}
                    onGuardarEstado={actualizarEstado} 
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {dialogoConfirmacion && (
        <div className="fixed inset-0 bg-slate-900/40 in-[.modo-oscuro_&]:bg-black/60 flex items-center justify-center z-100 p-4 backdrop-blur-sm animate-fade-in-up">
          <div className="bg-white in-[.modo-oscuro_&]:bg-slate-800 border border-rose-100 in-[.modo-oscuro_&]:border-slate-700 rounded-3xl shadow-2xl p-6 max-w-sm w-full text-center">
            <h3 className="text-xl font-bold text-slate-800 in-[.modo-oscuro_&]:text-slate-100 mb-6">{dialogoConfirmacion.mensaje}</h3>
            <div className="flex gap-4 justify-center">
              <button onClick={dialogoConfirmacion.accion} className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-xl flex-1 cursor-pointer active:scale-95 transition-transform shadow-md">Eliminar</button>
              <button onClick={() => setDialogoConfirmacion(null)} className="bg-slate-100 hover:bg-slate-200 in-[.modo-oscuro_&]:bg-slate-700 in-[.modo-oscuro_&]:hover:bg-slate-600 text-slate-800 in-[.modo-oscuro_&]:text-slate-200 font-bold py-3 px-6 rounded-xl flex-1 cursor-pointer active:scale-95 transition-transform">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}