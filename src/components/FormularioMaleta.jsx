import { supabase } from '../supabase'

export default function FormularioMaleta({ onExito, onCancelar }) {
  async function manejarEnvio(e) {
    e.preventDefault()
    const nombre = e.target.nombreMaleta.value.trim()
    if (!nombre) return alert('Debes indicar un nombre o destino.')

    const { error } = await supabase.from('maletas').insert([{ nombre }])
    if (error) alert("Error al crear maleta.")
    else onExito()
  }

  return (
    <form onSubmit={manejarEnvio} className="flex flex-col gap-5 text-left pb-4">
      <h2 className="text-2xl font-bold tracking-tight mb-2">Diseñar Maleta</h2>
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