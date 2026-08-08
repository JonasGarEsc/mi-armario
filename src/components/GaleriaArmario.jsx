import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function GaleriaArmario({ onCrearConjunto, onEditarPrenda }) {
  const [prendas, setPrendas] = useState([])
  const [seleccionadas, setSeleccionadas] = useState([])
  const [cargando, setCargando] = useState(true)
  
  const [busqueda, setBusqueda] = useState('')
  const [etiquetaFiltro, setEtiquetaFiltro] = useState('')

  useEffect(() => {
    async function obtenerPrendas() {
      const { data, error } = await supabase
        .from('prendas')
        .select('*, categorias(nombre, tipos(nombre)), prenda_etiqueta(etiquetas(id, nombre))')
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
    if (!confirm('¿Eliminar prenda de forma permanente?')) return
    await supabase.from('prendas').delete().eq('id', id)
    const nombreArchivo = urlImagen.split('/').pop()
    await supabase.storage.from('prendas').remove([nombreArchivo])
    setPrendas(prendas.filter(p => p.id !== id))
    setSeleccionadas(seleccionadas.filter(sel => sel !== id))
  }

  const prendasFiltradas = prendas.filter(prenda => {
    const term = busqueda.toLowerCase()
    const matchBusqueda = (prenda.nombre || '').toLowerCase().includes(term) || 
                          (prenda.categorias?.nombre || '').toLowerCase().includes(term) ||
                          (prenda.color_principal || '').toLowerCase().includes(term)
    
    const matchEtiqueta = etiquetaFiltro === '' || prenda.prenda_etiqueta.some(pe => pe.etiquetas?.nombre === etiquetaFiltro)
    return matchBusqueda && matchEtiqueta
  })

  const etiquetasUnicas = [...new Set(prendas.flatMap(p => p.prenda_etiqueta.map(pe => pe.etiquetas?.nombre)))].filter(Boolean)

  return (
    <div className="flex flex-col flex-1">
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input 
          type="text" 
          placeholder="Buscar por prenda, nombre o color..." 
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1 border border-rose-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-teal-400 dark:focus:ring-indigo-400 outline-none"
        />
        <select 
          value={etiquetaFiltro}
          onChange={(e) => setEtiquetaFiltro(e.target.value)}
          className="border border-rose-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl p-3 text-sm min-w-[200px] focus:ring-2 focus:ring-teal-400 dark:focus:ring-indigo-400 outline-none cursor-pointer"
        >
          <option value="">Todas las etiquetas</option>
          {etiquetasUnicas.map(tag => <option key={tag} value={tag}>{tag}</option>)}
        </select>
      </div>

      {seleccionadas.length >= 2 && (
        <button onClick={() => onCrearConjunto(seleccionadas)} className="mb-6 w-full bg-teal-400 dark:bg-indigo-500 text-slate-900 dark:text-white py-3 rounded-xl font-bold hover:bg-teal-500 dark:hover:bg-indigo-400 shadow-lg cursor-pointer transition-transform hover:scale-[1.01]">
          Guardar conjunto ({seleccionadas.length} prendas seleccionadas)
        </button>
      )}

      {cargando ? (
        <div className="flex items-center justify-center h-48 text-slate-400 dark:text-slate-500 font-medium">Cargando inventario...</div>
      ) : prendasFiltradas.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-slate-400 dark:text-slate-500 border-2 border-dashed border-rose-200 dark:border-slate-700 rounded-xl font-medium">Sin resultados.</div>
      ) : (
        // FIX: Se ha añadido el padding (p-2) para evitar que overflow-y-auto recorte los anillos (rings)
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 overflow-y-auto p-2 pb-4">
          {prendasFiltradas.map((prenda) => (
            <div 
              key={prenda.id} 
              onClick={() => alternarSeleccion(prenda.id)}
              className={`group relative border-2 rounded-2xl overflow-hidden cursor-pointer transition-all bg-white dark:bg-slate-800 shadow-sm ${
                seleccionadas.includes(prenda.id) 
                ? 'border-teal-400 dark:border-indigo-400 ring-4 ring-teal-200 dark:ring-indigo-500/50 scale-[1.02] shadow-md' 
                : 'border-rose-100 dark:border-slate-700 hover:border-teal-300 dark:hover:border-indigo-400'
              }`}
            >
              <div className="h-40 w-full bg-rose-50 dark:bg-slate-700">
                <img src={prenda.imagen_url} className="w-full h-full object-cover" alt={prenda.nombre} />
              </div>
              
              <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => eliminarPrenda(prenda.id, prenda.imagen_url, e)} className="bg-white/90 dark:bg-slate-800/90 text-red-500 hover:bg-red-500 hover:text-white w-7 h-7 rounded-full flex items-center justify-center font-bold shadow-sm text-xs cursor-pointer border border-rose-100 dark:border-slate-600" title="Eliminar">✕</button>
                <button onClick={(e) => { e.stopPropagation(); onEditarPrenda(prenda); }} className="bg-white/90 dark:bg-slate-800/90 text-teal-500 dark:text-indigo-400 hover:bg-teal-500 dark:hover:bg-indigo-500 hover:text-white w-7 h-7 rounded-full flex items-center justify-center font-bold shadow-sm text-xs cursor-pointer border border-rose-100 dark:border-slate-600" title="Editar">✎</button>
              </div>

              <div className="p-3 border-t border-rose-100 dark:border-slate-700">
                <p className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{prenda.nombre}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 capitalize truncate">{prenda.categorias?.nombre} • {prenda.color_principal}</p>
                
                {prenda.prenda_etiqueta.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {prenda.prenda_etiqueta.map(pe => (
                      <span key={pe.etiquetas.id} className="text-[10px] bg-rose-50 dark:bg-slate-700 font-semibold text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full border border-rose-100 dark:border-slate-600">{pe.etiquetas.nombre}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}