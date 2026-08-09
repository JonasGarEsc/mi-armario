import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { vibrar } from '../App'

export default function GaleriaArmario({ onCrearConjunto, onEditarPrenda }) {
  const [prendas, setPrendas] = useState([])
  const [seleccionadas, setSeleccionadas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [limiteVisibles, setLimiteVisibles] = useState(24)
  const [dialogoConfirmacion, setDialogoConfirmacion] = useState(null)

  useEffect(() => {
    async function obtenerPrendas() {
      const cache = localStorage.getItem('cache_prendas')
      if (cache) { setPrendas(JSON.parse(cache)); setCargando(false); }
      
      const { data } = await supabase.from('prendas').select('*, categorias(nombre, tipos(nombre))').order('creado_en', { ascending: false })
      if (data) { setPrendas(data); localStorage.setItem('cache_prendas', JSON.stringify(data)); }
      setCargando(false)
    }
    obtenerPrendas()
  }, [])

  useEffect(() => { setLimiteVisibles(24) }, [busqueda])

  function alternarSeleccion(id) {
    vibrar(30)
    if (seleccionadas.includes(id)) setSeleccionadas(seleccionadas.filter(item => item !== id))
    else setSeleccionadas([...seleccionadas, id])
  }

  function solicitarEliminacionPrenda(id, urlImagen, e) {
    e.stopPropagation()
    vibrar(50)
    setDialogoConfirmacion({
      mensaje: '¿Eliminar prenda del armario?',
      accion: async () => {
        await supabase.from('prendas').delete().eq('id', id)
        const nombreArchivo = urlImagen.split('/').pop()
        await supabase.storage.from('prendas').remove([nombreArchivo])
        const nuevasPrendas = prendas.filter(p => p.id !== id)
        setPrendas(nuevasPrendas)
        localStorage.setItem('cache_prendas', JSON.stringify(nuevasPrendas))
        setSeleccionadas(seleccionadas.filter(sel => sel !== id))
        setDialogoConfirmacion(null)
        vibrar([50, 50])
      }
    })
  }

  const prendasFiltradas = prendas.filter(prenda => {
    const term = busqueda.toLowerCase()
    return (prenda.nombre || '').toLowerCase().includes(term) || (prenda.categorias?.nombre || '').toLowerCase().includes(term)
  })
  const prendasVisibles = prendasFiltradas.slice(0, limiteVisibles)

  return (
    <div className="flex flex-col flex-1 animate-fade-in-up relative">
      <div className="mb-4 md:mb-6 w-full">
        <input 
          type="text" 
          autoComplete="off"
          placeholder="Buscar prenda..." 
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full border border-rose-200/50 in-[.modo-oscuro_&]:border-[#433D60] bg-white/80 backdrop-blur in-[.modo-oscuro_&]:bg-[#2A273F]/80 text-slate-800 in-[.modo-oscuro_&]:text-[#E0D8F0] rounded-xl p-3 md:p-4 text-sm md:text-base focus:ring-4 focus:ring-teal-400/30 in-[.modo-oscuro]:focus:ring-[#A394D6]/30 outline-none shadow-sm transition-all"
        />
      </div>

      {seleccionadas.length >= 2 && (
        <button onClick={() => onCrearConjunto(seleccionadas)} className="mb-4 md:mb-6 w-full bg-linear-to-r from-teal-400 to-emerald-400 in-[.modo-oscuro_&]:from-[#7E67C9] in-[.modo-oscuro_&]:to-[#9985D8] text-white py-3 md:py-4 rounded-xl font-bold shadow-lg shadow-teal-200/50 cursor-pointer active:scale-95 animate-pop-in text-sm md:text-base">
          Guardar conjunto ({seleccionadas.length} prendas)
        </button>
      )}

      {cargando ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-4">
          {[...Array(12)].map((_, i) => <div key={i} className="rounded-xl md:rounded-3xl h-32.5 md:h-55 bg-white/50 in-[.modo-oscuro_&]:bg-[#2A273F]/50 animate-shimmer shadow-sm"></div>)}
        </div>
      ) : prendasFiltradas.length === 0 ? (
        <p className="text-center text-slate-400 in-[.modo-oscuro_&]:text-[#7A7593] py-10 border-2 border-dashed border-rose-200/50 in-[.modo-oscuro_&]:border-[#433D60]/50 rounded-2xl text-sm">Vacío.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 md:gap-4 overflow-y-auto p-1 pb-4 hide-scrollbar">
            {prendasVisibles.map((prenda, index) => (
              <div 
                key={prenda.id} 
                onClick={() => alternarSeleccion(prenda.id)}
                className={`group relative rounded-xl md:rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 bg-white in-[.modo-oscuro_&]:bg-[#2A273F] shadow-sm hover:shadow-xl active:scale-95 ${
                  seleccionadas.includes(prenda.id) ? 'ring-2 md:ring-4 ring-teal-400 in-[.modo-oscuro_&]:ring-[#A394D6] scale-[1.02] shadow-md' : 'border border-rose-100 in-[.modo-oscuro_&]:border-[#433D60]'
                }`}
                style={{ animationDelay: `${(index % 18) * 40}ms` }}
              >
                <div className="aspect-square w-full bg-rose-50/30 in-[.modo-oscuro_&]:bg-[#1F1D2B]/50 relative flex items-center justify-center p-1 md:p-2">
                  <img src={prenda.imagen_url} loading="lazy" className="max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-105" alt={prenda.nombre} />
                  {seleccionadas.includes(prenda.id) && <div className="absolute top-1 left-1 md:top-2 md:left-2 bg-teal-400 in-[.modo-oscuro_&]:bg-[#A394D6] text-white w-4 h-4 md:w-6 md:h-6 rounded-full flex items-center justify-center font-bold text-[9px] md:text-xs shadow-md z-10">✓</div>}
                </div>

                <div className="absolute top-1 right-1 md:top-2 md:right-2 flex flex-col gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-300 z-20">
                  <button onClick={(e) => solicitarEliminacionPrenda(prenda.id, prenda.imagen_url, e)} className="bg-white/95 in-[.modo-oscuro_&]:bg-[#2A273F]/95 text-red-500 hover:bg-red-500 hover:text-white w-5 h-5 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold shadow-md text-[9px] md:text-xs cursor-pointer transition-all active:scale-90 border border-rose-100 in-[.modo-oscuro_&]:border-[#433D60]">✕</button>
                  <button onClick={(e) => { e.stopPropagation(); onEditarPrenda(prenda); }} className="bg-white/95 in-[.modo-oscuro_&]:bg-[#2A273F]/95 text-teal-500 in-[.modo-oscuro_&]:text-[#A394D6] hover:bg-teal-500 in-[.modo-oscuro_&]:hover:bg-[#A394D6] hover:text-white w-5 h-5 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold shadow-md text-[9px] md:text-sm cursor-pointer transition-all active:scale-90 border border-rose-100 in-[.modo-oscuro_&]:border-[#433D60]">✎</button>
                </div>

                <div className="p-1.5 md:p-3 bg-white/90 in-[.modo-oscuro_&]:bg-[#2A273F]/90 backdrop-blur z-10 relative border-t border-rose-50 in-[.modo-oscuro_&]:border-[#322F44]">
                  <p className="font-bold text-slate-800 in-[.modo-oscuro_&]:text-[#E0D8F0] text-[9px] md:text-sm truncate leading-tight">{prenda.nombre}</p>
                  <p className="text-[8px] md:text-xs text-slate-400 in-[.modo-oscuro_&]:text-[#7A7593] mt-0.5 md:mt-1 capitalize truncate">{prenda.categorias?.nombre}</p>
                </div>
              </div>
            ))}
          </div>

          {limiteVisibles < prendasFiltradas.length && (
            <div className="w-full flex justify-center mt-4 md:mt-6 mb-4">
              <button onClick={() => setLimiteVisibles(prev => prev + 24)} className="bg-white/80 in-[.modo-oscuro_&]:bg-[#2A273F]/80 text-slate-700 in-[.modo-oscuro_&]:text-[#D1C4E9] font-bold py-2 md:py-3 px-6 md:px-8 rounded-full shadow-sm active:scale-95 border border-rose-100 in-[.modo-oscuro_&]:border-[#433D60] text-sm md:text-base">
                Cargar más ↓
              </button>
            </div>
          )}
        </>
      )}

      {dialogoConfirmacion && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-100 p-4 backdrop-blur-sm animate-fade-in-up">
          <div className="bg-white in-[.modo-oscuro_&]:bg-[#1F1D2B] border border-rose-100 in-[.modo-oscuro_&]:border-[#433D60] rounded-2xl shadow-2xl p-5 max-w-sm w-full text-center">
            <h3 className="text-lg font-bold text-slate-800 in-[.modo-oscuro_&]:text-[#E0D8F0] mb-5">{dialogoConfirmacion.mensaje}</h3>
            <div className="flex gap-3 justify-center">
              <button onClick={dialogoConfirmacion.accion} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 px-4 rounded-xl flex-1 active:scale-95 transition-transform text-sm">Eliminar</button>
              <button onClick={() => setDialogoConfirmacion(null)} className="bg-slate-100 in-[.modo-oscuro_&]:bg-[#2A273F] hover:bg-slate-200 in-[.modo-oscuro_&]:hover:bg-[#34304D] text-slate-800 in-[.modo-oscuro_&]:text-[#E0D8F0] font-bold py-2.5 px-4 rounded-xl flex-1 active:scale-95 transition-transform text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}