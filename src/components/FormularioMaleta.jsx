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
    <form onSubmit={manejarEnvio} className="flex flex-col gap-4 text-left">
      <h2 className="titulo-hoja">Diseñar Maleta</h2>

      {error && (
        <div role="alert" className="aviso-error">{error}</div>
      )}
      <div>
        <label htmlFor="nombreMaleta" className="etiqueta">Destino o Fecha</label>
        <input id="nombreMaleta" type="text" name="nombreMaleta" autoComplete="off" required placeholder="Ej. París, Fin de semana..." className="campo" />
      </div>
      <div className="flex gap-3 mt-2">
        <button type="submit" className="boton boton-primario flex-1">Crear Maleta</button>
        <button type="button" onClick={onCancelar} className="boton boton-secundario flex-1">Cancelar</button>
      </div>
    </form>
  )
}
