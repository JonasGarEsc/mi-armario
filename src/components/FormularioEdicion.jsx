import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function FormularioEdicion({ prenda, onExito, onCancelar }) {
  const [nombre, setNombre] = useState(prenda.nombre)
  const [color, setColor] = useState(prenda.color_principal)
  const [temporada, setTemporada] = useState(prenda.temporada)
  
  const [etiquetasDisponibles, setEtiquetasDisponibles] = useState([])
  const [etiquetasSeleccionadas, setEtiquetasSeleccionadas] = useState([])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    supabase.from('etiquetas').select('*').then(({data}) => setEtiquetasDisponibles(data || []))
    // Cargar etiquetas actuales de la prenda
    const tagsActuales = prenda.prenda_etiqueta.map(pe => pe.etiquetas)
    setEtiquetasSeleccionadas(tagsActuales)
  }, [prenda])

  function manejarSeleccionEtiqueta(e) {
    const id = e.target.value
    if (id && !etiquetasSeleccionadas.find(et => et.id === id)) {
      const etiq = etiquetasDisponibles.find(et => et.id === id)
      setEtiquetasSeleccionadas([...etiquetasSeleccionadas, etiq])
    }
    e.target.value = '' 
  }

  async function guardarCambios(e) {
    e.preventDefault()
    setCargando(true)

    try {
      // 1. Actualizar datos base de la prenda
      const { error: errPrenda } = await supabase.from('prendas')
        .update({ nombre, color_principal: color, temporada })
        .eq('id', prenda.id)
      if (errPrenda) throw errPrenda

      // 2. Actualizar etiquetas (Borrar existentes y reinsertar las nuevas)
      await supabase.from('prenda_etiqueta').delete().eq('prenda_id', prenda.id)
      
      if (etiquetasSeleccionadas.length > 0) {
        const relaciones = etiquetasSeleccionadas.map(et => ({ prenda_id: prenda.id, etiqueta_id: et.id }))
        const { error: errTags } = await supabase.from('prenda_etiqueta').insert(relaciones)
        if (errTags) throw errTags
      }

      onExito()
    } catch (error) {
      alert('Error al actualizar: ' + error.message)
      setCargando(false)
    }
  }

  return (
    <form onSubmit={guardarCambios} className="flex flex-col gap-4 text-left mt-4">
      <div>
        <label className="block text-sm font-bold">Nombre Descriptivo</label>
        <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} className="border w-full p-2 rounded" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold">Color</label>
          <input type="text" required value={color} onChange={e => setColor(e.target.value)} className="border w-full p-2 rounded" />
        </div>
        <div>
          <label className="block text-sm font-bold">Temporada</label>
          <select required value={temporada} onChange={e => setTemporada(e.target.value)} className="border w-full p-2 rounded bg-white">
            <option value="Todas">Todas</option>
            <option value="Verano">Verano</option>
            <option value="Invierno">Invierno</option>
            <option value="Entretiempo">Entretiempo</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold">Etiquetas</label>
        <select onChange={manejarSeleccionEtiqueta} className="border w-full p-2 bg-white mb-2 rounded cursor-pointer">
          <option value="">Añadir etiqueta...</option>
          {etiquetasDisponibles.map(et => <option key={et.id} value={et.id}>{et.nombre}</option>)}
        </select>
        <div className="flex flex-wrap gap-2">
          {etiquetasSeleccionadas.map(et => (
            <span key={et.id} className="bg-gray-800 text-white text-xs px-2 py-1 rounded flex gap-1 items-center">
              {et.nombre}
              <button type="button" onClick={() => setEtiquetasSeleccionadas(etiquetasSeleccionadas.filter(t => t.id !== et.id))} className="font-bold cursor-pointer hover:text-red-400">✕</button>
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-4 mt-4">
        <button type="submit" disabled={cargando} className="bg-black text-white font-bold py-2 px-4 rounded w-full cursor-pointer hover:bg-gray-800">
          {cargando ? 'Guardando...' : 'Guardar Cambios'}
        </button>
        <button type="button" onClick={onCancelar} className="bg-gray-200 text-black font-bold py-2 px-4 rounded w-full cursor-pointer hover:bg-gray-300">
          Cancelar
        </button>
      </div>
    </form>
  )
}