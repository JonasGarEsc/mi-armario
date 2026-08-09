import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function VistaConjuntos({ onCrearMaleta }) {
  const [maletas, setMaletas] = useState([])
  const [conjuntos, setConjuntos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  
  const [abriendo, setAbriendo] = useState(null)
  const [maletaActiva, setMaletaActiva] = useState(null)

  useEffect(() => {
    async function cargarDatos() {
      setCargando(true)
      if (!maletaActiva) {
        const { data } = await supabase.from('maletas').select('*, conjuntos(id)').order('nombre')
        if (data) setMaletas(data)
      } else {
        const { data } = await supabase.from('conjuntos').select('id, nombre, conjunto_prenda ( prendas ( id, imagen_url, categorias ( nombre ) ) )').eq('maleta_id', maletaActiva.id).order('nombre')
        if (data) setConjuntos(data)
      }
      setCargando(false)
    }
    cargarDatos()
  }, [maletaActiva])

  async function eliminarMaleta(id, e) {
    e.stopPropagation()
    if (!confirm('¿Eliminar esta maleta y todos los conjuntos de su interior?')) return
    await supabase.from('maletas').delete().eq('id', id)
    setMaletas(maletas.filter(m => m.id !== id))
  }

  async function eliminarConjunto(id) {
    if (!confirm('¿Sacar este conjunto de la maleta?')) return
    await supabase.from('conjuntos').delete().eq('id', id)
    setConjuntos(conjuntos.filter(c => c.id !== id))
  }

  function abrirMaleta(maleta) {
    setAbriendo(maleta.id)
    setTimeout(() => {
      setMaletaActiva(maleta)
      setAbriendo(null)
    }, 650)
  }

  const itemsFiltrados = !maletaActiva 
    ? maletas.filter(m => m.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : conjuntos.filter(c => c.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  return (
    <div className="flex flex-col h-full w-full animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 border-b border-rose-100/50 in-[.modo-oscuro_&]:border-slate-700/50 pb-6 w-full">
        
        {maletaActiva ? (
          <button onClick={() => setMaletaActiva(null)} className="font-bold text-slate-700 in-[.modo-oscuro_&]:text-slate-200 bg-white/60 in-[.modo-oscuro_&]:bg-slate-700/50 px-5 py-3 rounded-2xl cursor-pointer shadow-sm hover:bg-white transition-all active:scale-95 border border-rose-200/50 in-[.modo-oscuro_&]:border-slate-600">
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
            <button onClick={onCrearMaleta} className="bg-linear-to-r from-teal-400 to-emerald-400 in-[.modo-oscuro_&]:from-indigo-500 in-[.modo-oscuro_&]:to-purple-500 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-teal-200/50 in-[.modo-oscuro_&]:shadow-indigo-900/50 whitespace-nowrap cursor-pointer transition-all hover:scale-105 active:scale-95 border border-white/20">
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
        <p className="text-center text-slate-400 py-10">Cargando...</p>
      ) : itemsFiltrados.length === 0 ? (
        <p className="text-center text-slate-400 py-10 border-2 border-dashed border-rose-200/50 rounded-3xl bg-white/30">Vacío.</p>
      ) : !maletaActiva ? (
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-y-16 gap-x-8 pt-8 px-2">
          {itemsFiltrados.map((m) => (
            <div key={m.id} className="relative group flex flex-col items-center justify-end w-full animate-pop-in">
              
              <button onClick={(e) => eliminarMaleta(m.id, e)} className="absolute -top-6 -right-2 z-50 opacity-0 group-hover:opacity-100 bg-white text-red-500 w-9 h-9 rounded-full font-bold flex items-center justify-center cursor-pointer hover:bg-red-500 hover:text-white transition-all shadow-lg border border-rose-100 active:scale-90">✕</button>

              {/* CONTENEDOR MALETA REALISTA */}
              <div onClick={() => abrirMaleta(m)} className="relative w-full max-w-65 aspect-4/3 perspective-[1400px] cursor-pointer transition-transform duration-500 hover:scale-105 hover:-translate-y-2 mb-3">
                 
                 {/* Asa (Efecto metálico oscuro y cuero) */}
                 <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-28 h-12 border-[7px] border-b-0 border-[#3d2516] rounded-t-3xl z-0 shadow-inner">
                    <div className="absolute top-0 left-1 w-2 h-full bg-[#1a0f09]"></div>
                    <div className="absolute top-0 right-1 w-2 h-full bg-[#1a0f09]"></div>
                 </div>

                 {/* INTERIOR (Oscuro y profundo) */}
                 <div className="absolute top-0 left-0 w-full h-full bg-linear-to-t from-black via-[#2a170b] to-[#4a2e1b] rounded-2xl shadow-xl border-4 border-[#3d2516] overflow-hidden z-10 flex flex-col justify-end p-2 pb-1">
                    <div className="absolute inset-0 shadow-[inset_0_20px_35px_rgba(0,0,0,0.9)] pointer-events-none"></div>

                    {/* Ropa realista interior */}
                    {m.conjuntos && m.conjuntos.length > 0 && (
                       <div className={`w-[85%] mx-auto transition-all duration-700 ease-out flex flex-col items-center justify-end z-10 ${abriendo === m.id ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                           <div className="w-[90%] h-5 bg-linear-to-r from-rose-400 to-rose-300 rounded-md border-t border-white/40 -mb-1 shadow-sm rotate-2"></div>
                           <div className="w-[96%] h-6 bg-linear-to-r from-slate-200 to-slate-100 rounded-md border-t border-white/60 -mb-1 shadow-sm -rotate-1"></div>
                           <div className="w-full h-8 bg-linear-to-r from-teal-600 to-teal-500 rounded-md border-t border-white/30 shadow-md"></div>
                       </div>
                    )}
                 </div>

                 {/* TAPA EXTERIOR (Cuero Premium) */}
                 <div className={`absolute top-0 left-0 w-full h-full bg-linear-to-br from-[#8A5A44] via-[#6d3c23] to-[#4c2a16] rounded-2xl origin-top transition-transform duration-650 ease-in-out border border-[#a06a38] z-30 shadow-[0_15px_30px_rgba(0,0,0,0.6)] overflow-hidden outline outline-[#a06a38] -outline-offset-2 ${abriendo === m.id ? 'transform-[rotateX(115deg)]' : ''}`}>
                    
                    {/* Costuras decorativas del borde */}
                    <div className="absolute inset-3 border border-dashed border-white/20 rounded-xl opacity-80"></div>
                    
                    {/* Correas de cuero oscuro */}
                    <div className="absolute left-[20%] top-0 w-10 h-full bg-linear-to-b from-[#3a2214] to-[#241309] shadow-[3px_0_10px_rgba(0,0,0,0.5)] flex flex-col justify-between py-4 items-center border-x border-white/5">
                        <div className="w-6 h-1.5 bg-linear-to-r from-gray-300 to-white rounded-full shadow-sm"></div>
                        <div className="w-6 h-1.5 bg-linear-to-r from-gray-300 to-white rounded-full shadow-sm"></div>
                    </div>
                    <div className="absolute right-[20%] top-0 w-10 h-full bg-linear-to-b from-[#3a2214] to-[#241309] shadow-[-3px_0_10px_rgba(0,0,0,0.5)] flex flex-col justify-between py-4 items-center border-x border-white/5">
                        <div className="w-6 h-1.5 bg-linear-to-r from-gray-300 to-white rounded-full shadow-sm"></div>
                        <div className="w-6 h-1.5 bg-linear-to-r from-gray-300 to-white rounded-full shadow-sm"></div>
                    </div>
                    
                    {/* Refuerzos de las esquinas */}
                    <div className="absolute top-0 left-0 w-12 h-12 bg-linear-to-br from-[#4A2E1B] to-[#2d1b0f] rounded-br-full shadow-[inset_-2px_-2px_4px_rgba(255,255,255,0.05)] border-b border-r border-white/10"></div>
                    <div className="absolute top-0 right-0 w-12 h-12 bg-linear-to-bl from-[#4A2E1B] to-[#2d1b0f] rounded-bl-full shadow-[inset_2px_-2px_4px_rgba(255,255,255,0.05)] border-b border-l border-white/10"></div>
                    <div className="absolute bottom-0 left-0 w-12 h-12 bg-linear-to-tr from-[#4A2E1B] to-[#2d1b0f] rounded-tr-full shadow-[inset_-2px_2px_4px_rgba(255,255,255,0.05)] border-t border-r border-white/10"></div>
                    <div className="absolute bottom-0 right-0 w-12 h-12 bg-linear-to-tl from-[#4A2E1B] to-[#2d1b0f] rounded-tl-full shadow-[inset_2px_2px_4px_rgba(255,255,255,0.05)] border-t border-l border-white/10"></div>
                    
                    {/* Cierres Dorados Metálicos */}
                    <div className="absolute bottom-6 left-[20%] -translate-x-1/2 w-10 h-8 bg-linear-to-b from-[#F3C623] via-[#B58500] to-[#805B00] border border-yellow-800 rounded-md shadow-lg flex justify-center items-center z-40">
                      <div className="w-2 h-4 bg-yellow-900 rounded-full shadow-inner opacity-80"></div>
                    </div>
                    <div className="absolute bottom-6 right-[20%] translate-x-1/2 w-10 h-8 bg-linear-to-b from-[#F3C623] via-[#B58500] to-[#805B00] border border-yellow-800 rounded-md shadow-lg flex justify-center items-center z-40">
                      <div className="w-2 h-4 bg-yellow-900 rounded-full shadow-inner opacity-80"></div>
                    </div>
                 </div>
              </div>

              <p className="mt-4 font-bold text-slate-800 in-[.modo-oscuro]:text-slate-100 text-center text-lg px-2 w-full truncate drop-shadow-sm">{m.nombre}</p>
            </div>
          ))}
        </div>

      ) : (
        
        <div className="flex flex-col gap-6 px-2">
          {itemsFiltrados.map((conj, index) => (
            <div key={conj.id} className="relative border border-white/50 in-[.modo-oscuro_&]:border-slate-700 p-6 rounded-4xl bg-white/70 backdrop-blur-md in-[.modo-oscuro]:bg-slate-800/80 shadow-lg shadow-rose-100/30 in-[.modo-oscuro_&]:shadow-black/20 group hover:shadow-xl transition-all animate-fade-in-up" style={{ animationDelay: `${index * 100}ms` }}>
              <button onClick={() => eliminarConjunto(conj.id)} className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 bg-white in-[.modo-oscuro_&]:bg-slate-700 text-red-500 w-9 h-9 rounded-full font-bold flex items-center justify-center cursor-pointer hover:bg-red-500 hover:text-white transition-all shadow-md border border-rose-100 in-[.modo-oscuro_&]:border-slate-600 active:scale-90 z-10">✕</button>
              <h3 className="font-extrabold text-xl mb-5 text-slate-800 in-[.modo-oscuro_&]:text-slate-100 pl-2">{conj.nombre}</h3>
              <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
                {conj.conjunto_prenda.map((cp) => (
                  <div key={cp.prendas.id} className="w-32 shrink-0 bg-white in-[.modo-oscuro_&]:bg-slate-700 p-2 border border-rose-100/50 in-[.modo-oscuro_&]:border-slate-600 rounded-3xl shadow-sm hover:-translate-y-1 transition-transform cursor-pointer">
                    <img src={cp.prendas.imagen_url} className="w-full h-32 object-cover rounded-2xl" alt={cp.prendas.categorias?.nombre} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}