import { useState } from 'react'
import { supabase } from '../supabase'

export default function FormularioEdicion({ prenda, onExito, onCancelar }) {
  const [nombre, setNombre] = useState(prenda.nombre || '')
  const [cargando, setCargando] = useState(false)

  async function guardarCambios(e) {
    e.preventDefault()
    setCargando(true)

    try {
      const { error } = await supabase.from('prendas')
        .update({ nombre })
        .eq('id', prenda.id)
      
      if (error) throw error

      onExito()
    } catch (error) {
      alert('Error al actualizar: ' + error.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <form onSubmit={guardarCambios} className="flex flex-col gap-4 text-left mt-2">
      <div>
        <label className="block text-sm font-bold text-slate-700 in-[.modo-oscuro_&]:text-slate-200">
          Nombre Descriptivo (Ej. Pantalón negro cuero)
        </label>
        <input type="text" autoComplete="off" required value={nombre} onChange={e => setNombre(e.target.value)} className="border border-rose-200 in-[.modo-oscuro_&]:border-slate-700 w-full p-3 rounded-xl bg-white in-[.modo-oscuro_&]:bg-slate-700 text-slate-800 in-[.modo-oscuro_&]:text-slate-100 outline-none focus:ring-2 focus:ring-teal-400 in-[.modo-oscuro_&]:focus:ring-indigo-400 mt-1 shadow-sm" />
      </div>

      <div className="flex gap-4 mt-4">
        <button 
          type="submit" 
          disabled={cargando} 
          className="bg-teal-400 in-[.modo-oscuro_&]:bg-indigo-500 text-slate-900 in-[.modo-oscuro_&]:text-white font-bold py-3 px-4 rounded-xl w-full cursor-pointer hover:bg-teal-500 in-[.modo-oscuro_&]:hover:bg-indigo-400 shadow-lg active:scale-95 transition-transform"
        >
          {cargando ? 'Guardando...' : 'Guardar Cambios'}
        </button>
        <button 
          type="button" 
          onClick={onCancelar} 
          className="bg-rose-100 in-[.modo-oscuro_&]:bg-slate-700 text-slate-700 in-[.modo-oscuro_&]:text-slate-200 font-bold py-3 px-4 rounded-xl w-full cursor-pointer hover:bg-rose-200 in-[.modo-oscuro_&]:hover:bg-slate-600 active:scale-95 transition-transform"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}