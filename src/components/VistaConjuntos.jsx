import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function VistaConjuntos() {
  const [conjuntos, setConjuntos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    async function obtenerConjuntos() {
      const { data, error } = await supabase
        .from('conjuntos')
        .select('id, nombre, temporada_ideal, conjunto_prenda ( prendas ( id, imagen_url, categorias ( nombre ) ) )')
        .order('creado_en', { ascending: false })

      if (!error) setConjuntos(data)
      setCargando(false)
    }
    obtenerConjuntos()
  }, [])

  async function eliminarConjunto(id) {
    if (!confirm('¿Seguro que quieres eliminar este conjunto? Las prendas no se borrarán.')) return
    await supabase.from('conjuntos').delete().eq('id', id)
    setConjuntos(conjuntos.filter(c => c.id !== id))
  }

  const conjuntosFiltrados = conjuntos.filter(conj => 
    conj.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <input 
          type="text" 
          placeholder="Buscar conjunto por nombre..." 
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full sm:w-1/2 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-black outline-none"
        />
      </div>

      {cargando ? (
        <p className="text-center text-gray-500 py-10">Cargando conjuntos...</p>
      ) : conjuntosFiltrados.length === 0 ? (
        <p className="text-center text-gray-500 py-10">No hay conjuntos que coincidan con la búsqueda.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {conjuntosFiltrados.map((conj) => (
            <div key={conj.id} className="relative border p-4 rounded-lg bg-gray-50 shadow-sm group">
              <button 
                onClick={() => eliminarConjunto(conj.id)}
                className="absolute top-2 right-2 bg-white/90 text-red-600 hover:bg-red-600 hover:text-white w-8 h-8 rounded-full flex items-center justify-center font-bold opacity-0 group-hover:opacity-100 transition-opacity shadow"
                title="Eliminar conjunto"
              >✕</button>

              <h3 className="font-bold text-lg mb-3">{conj.nombre}</h3>
              
              <div className="flex gap-3 overflow-x-auto pb-2">
                {conj.conjunto_prenda.map((cp) => (
                  <div key={cp.prendas.id} className="w-24 flex-shrink-0 bg-white p-1 border rounded shadow-sm">
                    <img 
                      src={cp.prendas.imagen_url} 
                      className="w-full h-24 object-cover rounded-sm" 
                      alt={cp.prendas.categorias?.nombre}
                    />
                    <p className="text-xs text-center mt-1 font-medium truncate">
                      {cp.prendas.categorias?.nombre}
                    </p>
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