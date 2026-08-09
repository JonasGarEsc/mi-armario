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
  
  // Guarda el punto exacto donde el usuario hace clic dentro de la imagen
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const handlePointerDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
    
    // Eleva la prenda a la capa superior
    const nuevoZ = maxZ + 1
    setZIndex(nuevoZ)
    setMaxZ(nuevoZ)
    
    setIsDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e) => {
    if (!isDragging) return
    
    const contenedor = e.currentTarget.parentElement.getBoundingClientRect()
    
    // Calcula la posición restando el offset para que la prenda siga al dedo exactamente
    let newX = e.clientX - contenedor.left - offset.x
    let newY = e.clientY - contenedor.top - offset.y

    // Límite de colisiones: Evita que la prenda salga de la casilla (128px es el ancho/alto de w-32/h-32)
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
    // Guarda X, Y y Z en la base de datos
    onGuardarEstado(cp.conjunto_id, cp.prenda_id, pos.x, pos.y, zIndex)
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, touchAction: 'none', zIndex: isDragging ? maxZ + 2 : zIndex }}
      className={`absolute w-32 h-32 flex items-center justify-center transition-transform ${isDragging ? 'scale-110 cursor-grabbing' : 'cursor-grab active:scale-105'}`}
    >
      <img src={cp.prendas.imagen_url} draggable="false" className="max-w-full max-h-full object-contain pointer-events-none drop-shadow-md" alt="Ropa" />
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
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-y-16 gap-x-8 pt-8 px-2">
          {itemsFiltrados.map((m) => (
            <div key={m.id} className="relative group flex flex-col items-center justify-end w-full animate-pop-in">
              <button onClick={(e) => solicitarEliminacionMaleta(m.id, e)} className="absolute -top-6 -right-2 z-50 opacity-0 group-hover:opacity-100 bg-white text-red-500 w-9 h-9 rounded-full font-bold flex items-center justify-center cursor-pointer shadow-lg border border-rose-100 active:scale-90 transition-all">✕</button>

              <div onClick={() => abrirMaleta(m)} className="relative w-full max-w-65 aspect-4/3 perspective-[1400px] cursor-pointer transition-transform duration-500 hover:scale-105 mb-3">
                 <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-28 h-12 border-[7px] border-b-0 border-[#3d2516] rounded-t-3xl z-0 shadow-inner"></div>
                 <div className="absolute top-0 left-0 w-full h-full bg-linear-to-t from-black via-[#2a170b] to-[#4a2e1b] rounded-2xl shadow-xl border-4 border-[#3d2516] overflow-hidden z-10 flex flex-col justify-end p-2 pb-1">
                    <div className="absolute inset-0 shadow-[inset_0_20px_35px_rgba(0,0,0,0.9)] pointer-events-none"></div>
                    {m.conjuntos && m.conjuntos.length > 0 && (
                       <div className={`w-[85%] mx-auto transition-all duration-700 ease-out flex flex-col items-center justify-end z-10 ${abriendo === m.id ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                           <div className="w-[90%] h-5 bg-linear-to-r from-rose-400 to-rose-300 rounded-md border-t border-white/40 -mb-1 shadow-sm rotate-2"></div>
                           <div className="w-[96%] h-6 bg-linear-to-r from-slate-200 to-slate-100 rounded-md border-t border-white/60 -mb-1 shadow-sm -rotate-1"></div>
                           <div className="w-full h-8 bg-linear-to-r from-teal-600 to-teal-500 rounded-md border-t border-white/30 shadow-md"></div>
                       </div>
                    )}
                 </div>
                 <div className={`absolute top-0 left-0 w-full h-full bg-linear-to-br from-[#8A5A44] via-[#6d3c23] to-[#4c2a16] rounded-2xl origin-top transition-transform duration-650 border border-[#a06a38] z-30 shadow-[0_15px_30px_rgba(0,0,0,0.6)] overflow-hidden ${abriendo === m.id ? 'transform-[rotateX(115deg)]' : ''}`}>
                    <div className="absolute inset-3 border border-dashed border-white/20 rounded-xl opacity-80"></div>
                    <div className="absolute left-[20%] top-0 w-10 h-full bg-linear-to-b from-[#3a2214] to-[#241309] shadow-[3px_0_10px_rgba(0,0,0,0.5)] border-x border-white/5"></div>
                    <div className="absolute right-[20%] top-0 w-10 h-full bg-linear-to-b from-[#3a2214] to-[#241309] shadow-[-3px_0_10px_rgba(0,0,0,0.5)] border-x border-white/5"></div>
                    <div className="absolute bottom-6 left-[20%] -translate-x-1/2 w-10 h-8 bg-linear-to-b from-[#F3C623] via-[#B58500] to-[#805B00] border border-yellow-800 rounded-md shadow-lg z-40"></div>
                    <div className="absolute bottom-6 right-[20%] translate-x-1/2 w-10 h-8 bg-linear-to-b from-[#F3C623] via-[#B58500] to-[#805B00] border border-yellow-8₀ rounded-md shadow-lg z-4₀"></div>
                 </div>
              </div>
              <p className="mt-3 font-bold text-slate-800 in-[.modo-oscuro_&]:text-slate-100 text-center text-lg px-2 w-full truncate drop-shadow-sm">{m.nombre}</p>
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