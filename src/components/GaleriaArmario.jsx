import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { vibrar } from '../App'

export default function GaleriaArmario({ onCrearConjunto, onEditarPrenda, mostrarToast, filtroCategoria, setDialogoGlobal }) {
  const [prendas, setPrendas] = useState([])
  const [seleccionadas, setSeleccionadas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [limiteVisibles, setLimiteVisibles] = useState(24)
  const observadorReferencia = useRef(null)

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

  useEffect(() => { setLimiteVisibles(24) }, [busqueda, filtroCategoria])

  const prendasFiltradas = prendas.filter(prenda => {
    const term = busqueda.toLowerCase()
    const coincideBusqueda = (prenda.nombre || '').toLowerCase().includes(term) || (prenda.categorias?.nombre || '').toLowerCase().includes(term)
    const coincideFiltro = filtroCategoria ? prenda.categoria_id === filtroCategoria : true
    return coincideBusqueda && coincideFiltro
  })

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && limiteVisibles < prendasFiltradas.length) {
        setLimiteVisibles(prev => prev + 24)
      }
    }, { threshold: 0.1 })
    if (observadorReferencia.current) observer.observe(observadorReferencia.current)
    return () => observer.disconnect()
  }, [limiteVisibles, prendasFiltradas.length])

  function alternarSeleccion(id) {
    vibrar(30)
    if (seleccionadas.includes(id)) setSeleccionadas(seleccionadas.filter(item => item !== id))
    else setSeleccionadas([...seleccionadas, id])
  }

  function solicitarEliminacionPrenda(id, urlImagen, e) {
    e.stopPropagation()
    setDialogoGlobal({
      mensaje: '¿Eliminar prenda del armario?',
      esDestructivo: true,
      textoConfirmar: 'Eliminar',
      onConfirm: async () => {
        await supabase.from('prendas').delete().eq('id', id)
        const nombreArchivo = urlImagen.split('/').pop()
        await supabase.storage.from('prendas').remove([nombreArchivo])
        const nuevasPrendas = prendas.filter(p => p.id !== id)
        setPrendas(nuevasPrendas)
        localStorage.setItem('cache_prendas', JSON.stringify(nuevasPrendas))
        setSeleccionadas(seleccionadas.filter(sel => sel !== id))
        vibrar([50, 50])
        mostrarToast("Prenda eliminada", "info")
      }
    })
  }

  const prendasVisibles = prendasFiltradas.slice(0, limiteVisibles)

  return (
    <div className="flex flex-col flex-1 relative shrink-0">
      <div className="mb-4">
        <input 
          type="text" 
          autoComplete="off"
          placeholder="Buscar..." 
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 rounded-full px-4 py-3 text-sm outline-none placeholder-neutral-500 transition-colors border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-700"
        />
      </div>

      {seleccionadas.length >= 2 && (
        <button onClick={() => onCrearConjunto(seleccionadas)} className="mb-4 w-full bg-black in-[.modo-oscuro]:bg-white text-white in-[.modo-oscuro]:text-black py-3 rounded-lg font-semibold active:scale-[0.98] transition-transform text-sm touch-manipulation">
          Crear Outfit ({seleccionadas.length})
        </button>
      )}

      {cargando ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-0.5 md:gap-2">
          {[...Array(12)].map((_, i) => <div key={i} className="aspect-square bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 animate-pulse"></div>)}
        </div>
      ) : prendasFiltradas.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">No hay prendas.</div>
      ) : (
        <div className="flex flex-col flex-1">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-0.5 md:gap-2">
            {prendasVisibles.map((prenda) => (
              <div 
                key={prenda.id} 
                onClick={() => alternarSeleccion(prenda.id)}
                className={`relative aspect-square cursor-pointer active:opacity-70 transition-opacity bg-neutral-50 in-[.modo-oscuro]:bg-neutral-900 touch-manipulation ${
                  seleccionadas.includes(prenda.id) ? 'ring-2 ring-inset ring-black in-[.modo-oscuro]:ring-white' : ''
                }`}
              >
                <img 
                  src={`${prenda.imagen_url}?width=250&quality=75`} 
                  loading="lazy" 
                  decoding="async"
                  className="w-full h-full object-contain p-2" 
                  alt={prenda.nombre} 
                />
                
                {seleccionadas.includes(prenda.id) && (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-black in-[.modo-oscuro]:bg-white rounded-full flex items-center justify-center border-2 border-white in-[.modo-oscuro]:border-black">
                    <span className="text-white in-[.modo-oscuro]:text-black text-[10px] font-bold">✓</span>
                  </div>
                )}

                <div className="absolute bottom-1 left-1 flex gap-1 z-10">
                  <button onClick={(e) => solicitarEliminacionPrenda(prenda.id, prenda.imagen_url, e)} className="bg-white/90 in-[.modo-oscuro]:bg-black/90 w-6 h-6 rounded-full flex items-center justify-center shadow-sm text-red-500 text-[10px] active:scale-90 touch-manipulation">✕</button>
                  <button onClick={(e) => { e.stopPropagation(); onEditarPrenda(prenda); }} className="bg-white/90 in-[.modo-oscuro]:bg-black/90 w-6 h-6 rounded-full flex items-center justify-center shadow-sm text-black in-[.modo-oscuro]:text-white text-[10px] active:scale-90 touch-manipulation">✎</button>
                </div>
              </div>
            ))}
          </div>
          {limiteVisibles < prendasFiltradas.length && (
            <div ref={observadorReferencia} className="w-full h-10 my-4 flex justify-center items-center">
              <div className="w-5 h-5 border-2 border-neutral-300 border-t-black in-[.modo-oscuro]:border-neutral-700 in-[.modo-oscuro]:border-t-white rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}