import { useState } from 'react'
import { supabase } from '../supabase'

export default function FormularioMaleta({ onExito, onCancelar }) {
  const [error, setError] = useState('')

  async function manejarEnvio(e) {
    e.preventDefault()
    setError('')
    const nombre = e.target.nombreMaleta.value.trim()
    const destino = e.target.destino.value.trim()
    const fechaInicio = e.target.fechaInicio.value || null
    const fechaFin = e.target.fechaFin.value || null

    if (!nombre) return setError('Debes indicar un nombre o destino.')
    if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
      return setError('La fecha de vuelta no puede ser anterior a la de ida.')
    }

    const { data: creada, error: errInsert } = await supabase.from('maletas').insert([{
      nombre,
      destino: destino || null,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
    }]).select().single()

    if (errInsert) {
      setError(errInsert.message?.toLowerCase().includes('duplicate')
        ? 'Ya tienes una maleta con ese nombre.'
        : 'Error al crear la maleta.')
    } else {
      onExito(creada)
    }
  }

  return (
    <form onSubmit={manejarEnvio} className="flex flex-col gap-4 text-left">
      <h2 className="titulo-hoja">Diseñar maleta</h2>

      {error && (
        <div role="alert" className="aviso-error">{error}</div>
      )}
      <div>
        <label htmlFor="nombreMaleta" className="etiqueta">Nombre</label>
        <input id="nombreMaleta" type="text" name="nombreMaleta" autoComplete="off" required placeholder="Ej. París, Fin de semana..." className="campo" />
      </div>

      <div>
        <label htmlFor="destino" className="etiqueta">Ciudad o destino (para el clima)</label>
        <input id="destino" type="text" name="destino" autoComplete="off" placeholder="París" className="campo" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="fechaInicio" className="etiqueta">Ida</label>
          <input id="fechaInicio" type="date" name="fechaInicio" className="campo" />
        </div>
        <div>
          <label htmlFor="fechaFin" className="etiqueta">Vuelta</label>
          <input id="fechaFin" type="date" name="fechaFin" className="campo" />
        </div>
      </div>

      <div className="flex gap-3 mt-2">
        <button type="submit" className="boton boton-primario flex-1">Crear maleta</button>
        <button type="button" onClick={onCancelar} className="boton boton-secundario flex-1">Cancelar</button>
      </div>
    </form>
  )
}
