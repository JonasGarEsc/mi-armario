import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { vibrar } from '../App'
import { leerCache, guardarCache } from '../lib/cache'

// La caché solo necesita lo que pinta la rejilla, no el árbol de categorías entero.
const resumenPrenda = (p) => ({
  id: p.id,
  nombre: p.nombre,
  imagen_url: p.imagen_url,
  categoria_id: p.categoria_id,
  categorias: p.categorias ? { nombre: p.categorias.nombre } : null
})

// Rejilla ligera: Supabase reduce y recodifica la foto en AVIF (~9 kB). Si falla, se usa el original.
const conTamano = (url) =>
  url && url.includes('/storage/v1/object/public/')
    ? url.replace('/object/public/', '/render/image/public/') + '?width=480&resize=contain&quality=70&format=avif'
    : url

export default function GaleriaArmario({ onCrearConjunto, onEditarPrenda, onAnadirPrenda, mostrarToast, filtroCategoria, setDialogoGlobal }) {
  const [prendas, setPrendas] = useState([])
  const [seleccionadas, setSeleccionadas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [limiteVisibles, setLimiteVisibles] = useState(24)
  const observadorReferencia = useRef(null)

  useEffect(() => {
    async function obtenerPrendas() {
      const cache = leerCache('prendas')
      if (cache) { setPrendas(cache); setCargando(false); }

      const { data } = await supabase.from('prendas').select('*, categorias(nombre, tipos(id, nombre))').order('creado_en', { ascending: false })
      if (data) { setPrendas(data); guardarCache('prendas', data.map(resumenPrenda)); }
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

  function solicitarEliminacionPrenda(prenda, e) {
    e.stopPropagation()
    setDialogoGlobal({
      mensaje: '¿Eliminar esta prenda?',
      esDestructivo: true,
      textoConfirmar: 'Eliminar',
      onConfirm: async () => {
        const { error } = await supabase.from('prendas').delete().eq('id', prenda.id)
        if (error) return mostrarToast('No se pudo eliminar la prenda', 'error')
        const nuevasPrendas = prendas.filter(p => p.id !== prenda.id)
        setPrendas(nuevasPrendas)
        guardarCache('prendas', nuevasPrendas.map(resumenPrenda))
        setSeleccionadas(seleccionadas.filter(sel => sel !== prenda.id))
        vibrar([50, 50])

        // La foto se borra 7 s después. Mientras el aviso siga en pantalla, se puede deshacer.
        const archivo = prenda.imagen_url.split('/').pop()
        let deshecho = false
        mostrarToast('Prenda eliminada', 'info', {
          texto: 'Deshacer',
          onClick: async () => {
            deshecho = true
            const fila = { id: prenda.id, nombre: prenda.nombre, imagen_url: prenda.imagen_url, categoria_id: prenda.categoria_id }
            const { error: errRecuperar } = await supabase.from('prendas').insert([fila])
            if (errRecuperar) return mostrarToast('No se pudo recuperar la prenda', 'error')
            const recuperadas = [prenda, ...nuevasPrendas]
            setPrendas(recuperadas)
            guardarCache('prendas', recuperadas.map(resumenPrenda))
            mostrarToast('Prenda recuperada', 'exito')
          }
        })
        setTimeout(() => { if (!deshecho) supabase.storage.from('prendas').remove([archivo]) }, 7500)
      }
    })
  }

  const prendasVisibles = prendasFiltradas.slice(0, limiteVisibles)

  return (
    <div className="flex flex-col flex-1 relative shrink-0">
      <div className="mb-5 md:mb-7 flex items-center gap-3 border-b border-linea">
        <svg className="w-4 h-4 text-tenue shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" /></svg>
        <input
          type="text"
          autoComplete="off"
          aria-label="Buscar prendas"
          placeholder="Buscar por nombre o categoría"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full min-w-0 bg-transparent py-2.5 text-sm outline-none placeholder:text-tenue"
        />
      </div>

      {seleccionadas.length >= 2 && (
        <button onClick={() => onCrearConjunto(seleccionadas)} className="mb-5 w-full bg-tinta text-papel py-3 active:opacity-80 transition-opacity text-sm touch-manipulation">
          Crear outfit con {seleccionadas.length} prendas
        </button>
      )}

      {cargando ? (
        <div className="rejilla">
          {[...Array(12)].map((_, i) => <div key={i} className="aspect-4/5 lamina animate-pulse"></div>)}
        </div>
      ) : prendasFiltradas.length === 0 ? (
        <div className="flex-1 flex flex-col items-start md:items-center justify-center gap-3 py-16 md:py-24">
          <p className="font-display text-2xl md:text-3xl text-tinta">Aún no hay prendas</p>
          <p className="text-sm text-tenue max-w-xs md:text-center">Empieza por la que más te pones. La foto se recorta sola.</p>
          {onAnadirPrenda && (
            <button onClick={onAnadirPrenda} className="mt-2 bg-tinta text-papel px-5 py-3 text-sm active:opacity-80 transition-opacity touch-manipulation">Añadir una prenda</button>
          )}
        </div>
      ) : (
        <div className="flex flex-col flex-1">
          <div className="rejilla">
            {prendasVisibles.map((prenda) => {
              const seleccionada = seleccionadas.includes(prenda.id)
              return (
                <article key={prenda.id} className="group flex flex-col">
                  <div className={`relative w-full aspect-4/5 lamina overflow-hidden ${seleccionada ? 'ring-1 ring-acento' : ''}`}>
                    <button
                      onClick={() => alternarSeleccion(prenda.id)}
                      aria-pressed={seleccionada}
                      aria-label={`Seleccionar ${prenda.nombre}`}
                      className="absolute inset-0 w-full h-full touch-manipulation active:opacity-80 transition-opacity"
                    >
                      <img
                        src={conTamano(prenda.imagen_url)}
                        onError={(e) => { if (e.currentTarget.src !== prenda.imagen_url) { e.currentTarget.srcset = ''; e.currentTarget.src = prenda.imagen_url } }}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain p-3 md:p-5 transition-transform duration-500 md:group-hover:scale-[1.03]"
                        alt={prenda.nombre}
                      />
                    </button>

                    {seleccionada && (
                      <span className="absolute top-2 left-2 bg-acento text-papel text-[10px] w-5 h-5 flex items-center justify-center">✓</span>
                    )}

                    <div className="absolute top-1 right-1 flex gap-0.5 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); onEditarPrenda(prenda) }} aria-label={`Editar ${prenda.nombre}`} className="w-8 h-8 flex items-center justify-center text-tinta bg-papel/85 hover:bg-papel active:opacity-60 touch-manipulation">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 4.5l3 3L7 20H4v-3L16.5 4.5z" /></svg>
                      </button>
                      <button onClick={(e) => solicitarEliminacionPrenda(prenda, e)} aria-label={`Eliminar ${prenda.nombre}`} className="w-8 h-8 flex items-center justify-center text-tinta bg-papel/85 hover:bg-papel hover:text-red-700 active:opacity-60 touch-manipulation">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 md:mt-3 min-w-0">
                    <p className="font-display text-base md:text-lg leading-tight truncate">{prenda.nombre || 'Sin nombre'}</p>
                    <p className="text-[11px] md:text-xs text-tenue truncate">{prenda.categorias?.nombre || 'Sin categoría'}</p>
                  </div>
                </article>
              )
            })}
          </div>
          {limiteVisibles < prendasFiltradas.length && (
            <div ref={observadorReferencia} className="w-full h-10 my-4 flex justify-center items-center">
              <div className="w-5 h-5 border border-linea border-t-tinta rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
