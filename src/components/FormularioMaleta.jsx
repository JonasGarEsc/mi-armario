import { useState } from 'react'
import { supabase } from '../supabase'

export default function FormularioMaleta({ onExito, onCancelar }) {
  const [error, setError] = useState('')

  async function manejarEnvio(e) {
    e.preventDefault()
    setError('')
    const nombre = e.target.nombreMaleta.value.trim()
    if (!nombre) return setError('Debes indicar un nombre o destino.')

    const { error: errInsert } = await supabase.from('maletas').insert([{ nombre }])
    if (errInsert) setError('Error al crear la maleta.')
    else onExito()
  }

  return (
    <form onSubmit={manejarEnvio} className="flex flex-col gap-5 text-left pb-4">
      <h2 className="text-2xl font-bold tracking-tight mb-2">Diseñar Maleta</h2>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-100 in-[.modo-oscuro]:bg-red-900/30 border border-red-200 in-[.modo-oscuro]:border-red-800 text-red-700 in-[.modo-oscuro]:text-red-400">
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}
      <div>
        <label className="block text-sm font-semibold mb-2 text-neutral-700 in-[.modo-oscuro]:text-neutral-300">Destino o Fecha</label>
        <input type="text" name="nombreMaleta" autoComplete="off" required placeholder="Ej. París, Fin de semana..." className="w-full p-4 rounded-xl bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-700 outline-none transition-colors text-sm" />
      </div>
      <div className="flex gap-3 mt-4">
        <button type="submit" className="flex-1 bg-black in-[.modo-oscuro]:bg-white text-white in-[.modo-oscuro]:text-black font-bold py-4 rounded-xl active:scale-[0.98] transition-transform text-sm">Crear Maleta</button>
        <button type="button" onClick={onCancelar} className="flex-1 bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 text-neutral-900 in-[.modo-oscuro]:text-white font-bold py-4 rounded-xl active:scale-[0.98] transition-transform text-sm">Cancelar</button>
      </div>
    </form>
  )
}
