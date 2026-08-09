import { useState } from 'react'
import { supabase } from '../supabase'

export default function FormularioMaleta({ onExito, onCancelar }) {
  const [cargando, setCargando] = useState(false)

  async function manejarEnvio(e) {
    e.preventDefault()
    setCargando(true)

    const nombre = e.target.nombre.value.trim()

    if (!nombre) {
      alert('El nombre es obligatorio.')
      setCargando(false)
      return
    }

    try {
      const { error: errMaleta } = await supabase.from('maletas').insert([{
        nombre,
        imagen_url: null, // Forzamos nulo por si quedó el campo en la BD
        icono: '💼'
      }])

      if (errMaleta) throw new Error('Error al guardar en la base de datos.')

      e.target.reset()
      if (onExito) onExito()

    } catch (error) {
      alert(error.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <form onSubmit={manejarEnvio} className="flex flex-col gap-4 text-left mt-2">
      <div>
        <label className="block text-sm font-bold text-slate-700 in-[.modo-oscuro_&]:text-slate-200">Nombre de la maleta o viaje</label>
        <input 
          type="text" 
          name="nombre" 
          required 
          placeholder="Ej. Viaje a París..." 
          className="border border-rose-200 in-[.modo-oscuro_&]:border-slate-700 w-full p-3 rounded-xl bg-white in-[.modo-oscuro_&]:bg-slate-700 text-slate-800 in-[.modo-oscuro_&]:text-slate-100 outline-none focus:ring-2 focus:ring-teal-400 in-[.modo-oscuro_&]:focus:ring-indigo-400 mt-1 shadow-sm" 
        />
      </div>

      <div className="flex gap-4 mt-4">
        <button type="submit" disabled={cargando} className="bg-teal-400 in-[.modo-oscuro_&]:bg-indigo-500 text-slate-900 in-[.modo-oscuro_&]:text-white font-bold py-3 px-4 rounded-xl w-full cursor-pointer hover:bg-teal-500 in-[.modo-oscuro_&]:hover:bg-indigo-400 shadow-lg transition-transform hover:scale-105">
          {cargando ? 'Procesando...' : 'Crear Maleta'}
        </button>
        <button type="button" onClick={onCancelar} className="bg-rose-100 in-[.modo-oscuro_&]:bg-slate-700 text-slate-700 in-[.modo-oscuro_&]:text-slate-200 font-bold py-3 px-4 rounded-xl w-full cursor-pointer hover:bg-rose-200 in-[.modo-oscuro_&]:hover:bg-slate-600">
          Cancelar
        </button>
      </div>
    </form>
  )
}