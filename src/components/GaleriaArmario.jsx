import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function GaleriaArmario({ onCrearConjunto, onEditarPrenda }) {
  const [prendas, setPrendas] = useState([])
  const [seleccionadas, setSeleccionadas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    async function obtenerPrendas() {
      const { data } = await supabase
        .from('prendas')
        .select('*, categorias(nombre, tipos(nombre))')
        .order('creado_en', { ascending: false })
      if (data) setPrendas(data)
      setCargando(false)
    }
    obtenerPrendas()
  }, [])

  function alternarSeleccion(id) {
    if (seleccionadas.includes(id)) setSeleccionadas(seleccionadas.filter(item => item !== id))
    else setSeleccionadas([...seleccionadas, id])
  }

  async function eliminarPrenda(id, urlImagen, e) {
    e.stopPropagation()
    if (!confirm('¿Eliminar prenda permanentemente?')) return
    await supabase.from('prendas').delete().eq('id', id)
    const nombreArchivo = urlImagen.split('/').pop()
    await supabase.storage.from('prendas').remove([nombreArchivo])
    setPrendas(prendas.filter(p => p.id !== id))
    setSeleccionadas(seleccionadas.filter(sel => sel !== id))
  }

  const prendasFiltradas = prendas.filter(prenda => {
    const term = busqueda.toLowerCase()
    return (prenda.nombre || '').toLowerCase().includes(term) || 
           (prenda.categorias?.nombre || '').toLowerCase().includes(term)
  })

  return (
    <div className="flex flex-col flex-1 animate-fade-in-up">
      <div className="mb-6 w-full">
        <input 
          type="text" 
          placeholder="Buscar prenda..." 
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full border border-rose-200/50 [.modo-oscuro_&]:border-slate-600 bg-white/80 backdrop-blur [.modo-oscuro_&]:bg-slate-700/80 text-slate-800 [.modo-oscuro_&]:text-slate-100 rounded-2xl p-4 text-base focus:ring-4 focus:ring-teal-400/30 [.modo-oscuro_&]:focus:ring-indigo-400/30 outline-none shadow-sm transition-all"
        />
      </div>

      {seleccionadas.length >= 2 && (
        <button onClick={() => onCrearConjunto(seleccionadas)} className="mb-6 w-full bg-gradient-to-r from-teal-400 to-emerald-400 [.modo-oscuro_&]:from-indigo-500 [.modo-oscuro_&]:to-purple-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-teal-200/50 [.modo-oscuro_&]:shadow-indigo-900/50 cursor-pointer transition-all hover:scale-[1.02] active:scale-95 animate-pop-in">
          Guardar conjunto ({seleccionadas.length} prendas)
        </button>
      )}

      {cargando ? (
        <p className="text-center text-slate-400 py-10">Cargando...</p>
      ) : prendasFiltradas.length === 0 ? (
        <p className="text-center text-slate-400 py-10 border-2 border-dashed border-rose-200/50 rounded-2xl">Vacio.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 overflow-y-auto p-2 pb-4 hide-scrollbar">
          {prendasFiltradas.map((prenda, index) => (
            <div 
              key={prenda.id} 
              onClick={() => alternarSeleccion(prenda.id)}
              className={`group relative rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 bg-white [.modo-oscuro_&]:bg-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 active:scale-95 ${
                seleccionadas.includes(prenda.id) 
                ? 'ring-4 ring-teal-400 [.modo-oscuro_&]:ring-indigo-500 scale-[1.02] shadow-md' 
                : 'border border-rose-100 [.modo-oscuro_&]:border-slate-700'
              }`}
              style={{ animationDelay: `${index * 50}ms` }} // Efecto cascada
            >
              {/* Contenedor de imagen con Zoom al hacer hover */}
              <div className="h-44 w-full bg-rose-50 [.modo-oscuro_&]:bg-slate-700 overflow-hidden">
                <img src={prenda.imagen_url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={prenda.nombre} />
              </div>

              {/* Botones de acción (Aparecen con rebote) */}
              <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <button onClick={(e) => eliminarPrenda(prenda.id, prenda.imagen_url, e)} className="bg-white/95 [.modo-oscuro_&]:bg-slate-800/95 text-red-500 hover:bg-red-500 hover:text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md text-xs cursor-pointer transition-all active:scale-90" title="Eliminar">✕</button>
                <button onClick={(e) => { e.stopPropagation(); onEditarPrenda(prenda); }} className="bg-white/95 [.modo-oscuro_&]:bg-slate-800/95 text-teal-500 [.modo-oscuro_&]:text-indigo-400 hover:bg-teal-500 [.modo-oscuro_&]:hover:bg-indigo-500 hover:text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md text-sm cursor-pointer transition-all active:scale-90" title="Editar">✎</button>
              </div>

              <div className="p-4 bg-white/90 backdrop-blur [.modo-oscuro_&]:bg-slate-800/90 z-10 relative">
                <p className="font-bold text-slate-800 [.modo-oscuro_&]:text-slate-100 text-sm truncate">{prenda.nombre}</p>
                <p className="text-xs text-slate-400 [.modo-oscuro_&]:text-slate-400 mt-1 capitalize truncate">{prenda.categorias?.nombre}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}