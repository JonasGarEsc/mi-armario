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
      const { error: errPrenda } = await supabase.from('prendas')
        .update({ nombre, color_principal: color, temporada })
        .eq('id', prenda.id)
      if (errPrenda) throw errPrenda

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
        <label className="block text-sm font-bold text-slate-700 in-[.modo-oscuro_&]:text-slate-200">Nombre Descriptivo</label>
        <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} className="border border-rose-200 in-[.modo-oscuro_&]:border-slate-700 w-full p-2 rounded" />
      </div>
      <div className="flex gap-4 mt-4">
        <button type="submit" disabled={cargando} className="bg-teal-400 in-[.modo-oscuro_&]:bg-indigo-500 text-slate-900 in-[.modo-oscuro_&]:text-white font-bold py-2 px-4 rounded w-full cursor-pointer hover:bg-teal-500 in-[.modo-oscuro_&]:hover:bg-indigo-400 shadow">
          {cargando ? 'Guardando...' : 'Guardar Cambios'}
        </button>
        <button type="button" onClick={onCancelar} className="bg-rose-100 in-[.modo-oscuro_&]:bg-slate-700 text-slate-700 in-[.modo-oscuro_&]:text-slate-200 font-bold py-2 px-4 rounded w-full cursor-pointer hover:bg-rose-200 in-[.modo-oscuro_&]:hover:bg-slate-600">
          Cancelar
        </button>
      </div>
    </form>
  )
}