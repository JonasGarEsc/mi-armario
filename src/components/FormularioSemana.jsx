import { useState } from 'react'
import { supabase } from '../supabase'
import {
  DIAS, MESES, celdasMes, etiquetaRango, finDeSemana, isoLocal, lunesDe, mismoDia,
} from '../lib/fechas'
import Icono from './Icono'

export default function FormularioSemana({ onExito, onCancelar }) {
  const hoy = new Date()
  const [mes, setMes] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1))
  const [elegido, setElegido] = useState(null)
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const celdas = celdasMes(mes.getFullYear(), mes.getMonth())
  const inicio = elegido ? lunesDe(elegido) : null
  const fin = elegido ? finDeSemana(elegido) : null
  const rango = inicio ? etiquetaRango(isoLocal(inicio), isoLocal(fin)) : ''

  function elegirDia(dia) {
    if (!dia) return
    const ini = lunesDe(dia)
    const finDia = finDeSemana(dia)
    setElegido(dia)
    setNombre(etiquetaRango(isoLocal(ini), isoLocal(finDia)))
    setError('')
  }

  function moverMes(delta) {
    setMes(new Date(mes.getFullYear(), mes.getMonth() + delta, 1))
  }

  function irAHoy() {
    setMes(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
    elegirDia(hoy)
  }

  async function enviar(e) {
    e.preventDefault()
    if (!elegido) {
      setError('Elige un día en el calendario.')
      return
    }
    const desde = isoLocal(lunesDe(elegido))
    const hasta = isoLocal(finDeSemana(elegido))

    setGuardando(true)
    setError('')

    const { data: existente } = await supabase
      .from('semanas')
      .select('id')
      .eq('fecha_inicio', desde)
      .maybeSingle()

    if (existente) {
      setGuardando(false)
      setError('Ya tienes una semana que empieza ese día.')
      return
    }

    const { error: errInsert } = await supabase.from('semanas').insert([{
      nombre: nombre.trim() || etiquetaRango(desde, hasta),
      fecha_inicio: desde,
      fecha_fin: hasta,
    }])

    setGuardando(false)
    if (errInsert) {
      setError(errInsert.message?.toLowerCase().includes('duplicate')
        ? 'Ya tienes una semana que empieza ese día.'
        : 'No se pudo crear la semana. Revisa la conexión.')
      return
    }
    onExito()
  }

  const dentroDeLaSemana = (dia) => inicio && fin && dia >= inicio && dia <= fin

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4 text-left">
      <h2 className="titulo-hoja">Nueva semana</h2>

      {error && <div role="alert" className="aviso-error">{error}</div>}

      <div className="flex items-center gap-1">
        <button type="button" onClick={() => moverMes(-1)} aria-label="Mes anterior" className="boton-icono">
          <Icono nombre="volver" />
        </button>
        <p className="flex-1 text-center font-semibold capitalize">{MESES[mes.getMonth()]} {mes.getFullYear()}</p>
        <button type="button" onClick={() => moverMes(1)} aria-label="Mes siguiente" className="boton-icono rotate-180">
          <Icono nombre="volver" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-tenue" aria-hidden="true">
        {DIAS.map((dia) => <span key={dia} className="py-1 uppercase">{dia}</span>)}
      </div>

      <div className="grid grid-cols-7 gap-1 -mt-2">
        {celdas.map((dia, i) => {
          if (!dia) return <span key={`hueco-${i}`} />
          const seleccionado = mismoDia(dia, elegido)
          const enSemana = dentroDeLaSemana(dia)
          const esHoy = mismoDia(dia, hoy)
          return (
            <button
              key={isoLocal(dia)}
              type="button"
              onClick={() => elegirDia(dia)}
              aria-pressed={seleccionado}
              className={`relative h-10 rounded-lg text-sm transition-colors ${
                seleccionado
                  ? 'bg-acento text-sobre-acento font-bold'
                  : enSemana
                    ? 'bg-lamina text-tinta font-semibold'
                    : 'text-tinta hover:bg-lamina'
              } ${esHoy && !seleccionado ? 'ring-1 ring-acento' : ''}`}
            >
              {dia.getDate()}
            </button>
          )
        })}
      </div>

      <button type="button" onClick={irAHoy} className="self-start text-sm font-semibold text-acento min-h-9">
        Ir a hoy
      </button>

      <div className="rounded-2xl bg-lamina px-4 py-3 min-h-14 flex items-center">
        {inicio ? (
          <div className="min-w-0">
            <p className="font-semibold truncate">{rango}</p>
            <p className="text-sm text-tenue">De lunes a domingo</p>
          </div>
        ) : (
          <p className="text-sm text-tenue">Toca un día y se elige su semana completa.</p>
        )}
      </div>

      <div>
        <label htmlFor="nombreSemana" className="etiqueta">Nombre</label>
        <input
          id="nombreSemana"
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoComplete="off"
          placeholder="Semana en casa"
          className="campo"
        />
      </div>

      <div className="flex gap-3 mt-1">
        <button type="submit" disabled={guardando || !elegido} className="boton boton-primario flex-1">
          {guardando ? 'Creando…' : 'Crear semana'}
        </button>
        <button type="button" onClick={onCancelar} className="boton boton-secundario flex-1">Cancelar</button>
      </div>
    </form>
  )
}
