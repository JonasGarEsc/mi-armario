import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { procesarEnCola } from '../lib/cola'
import { COLUMNAS_ETIQUETADO, etiquetarPrenda, pendientesDeEtiquetar } from '../lib/etiquetarArmario'
import { vibrar } from '../lib/vibrar'

// Botón de Ajustes que etiqueta las prendas que ya tenías: de 3 en 3, con progreso,
// y se puede parar y reanudar (siempre empieza por las que faltan).
export default function EtiquetarArmario({ onTerminado }) {
  const [estado, setEstado] = useState('cargando') // cargando | listo | trabajando | error
  const [pendientes, setPendientes] = useState(0)
  const [progreso, setProgreso] = useState({ hechos: 0, total: 0, fallos: 0 })
  const [resultado, setResultado] = useState(null)
  const [errorLectura, setErrorLectura] = useState('')
  const control = useRef(null)

  async function contar() {
    const { data, error } = await supabase.from('prendas').select(COLUMNAS_ETIQUETADO)
    if (error) {
      setErrorLectura('No se pudo leer el armario para etiquetarlo.')
      setEstado('error')
      return []
    }
    setErrorLectura('')
    const faltan = pendientesDeEtiquetar(data || [])
    setPendientes(faltan.length)
    setEstado('listo')
    return faltan
  }

  useEffect(() => {
    contar()
    return () => control.current?.abort()
  }, [])

  async function empezar() {
    const faltan = await contar()
    if (faltan.length === 0) return
    control.current = new AbortController()
    setResultado(null)
    setProgreso({ hechos: 0, total: faltan.length, fallos: 0 })
    setEstado('trabajando')
    vibrar(20)

    const fin = await procesarEnCola(faltan, async (prenda) => {
      const r = await etiquetarPrenda(supabase, prenda)
      return r.ok
    }, { concurrencia: 3, signal: control.current.signal, onProgreso: setProgreso })

    setResultado(fin)
    await contar()
    onTerminado?.()
    vibrar([30, 30])
  }

  if (estado === 'cargando') return null

  if (estado === 'error') {
    return <p role="alert" className="aviso-error">{errorLectura}</p>
  }

  const trabajando = estado === 'trabajando'
  const porcentaje = progreso.total ? Math.round((progreso.hechos / progreso.total) * 100) : 0

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={trabajando ? () => control.current?.abort() : empezar}
        disabled={!trabajando && pendientes === 0}
        className="boton boton-secundario justify-between!"
      >
        {trabajando ? 'Parar el etiquetado' : pendientes === 0 ? 'Todo el armario está etiquetado' : `Etiquetar mi armario (${pendientes})`}
      </button>

      {trabajando && (
        <div>
          <div role="progressbar" aria-label="Etiquetando el armario" aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcentaje} className="h-2 rounded-full bg-lamina overflow-hidden">
            <div className="h-full bg-acento transition-[width] duration-300" style={{ width: `${porcentaje}%` }} />
          </div>
          <p className="text-sm text-tenue mt-1">{progreso.hechos} de {progreso.total}{progreso.fallos > 0 && ` · ${progreso.fallos} con error`}</p>
        </div>
      )}

      {!trabajando && resultado && (
        <p className="text-sm text-tenue">
          {resultado.cancelado ? 'Parado. ' : ''}
          {resultado.hechos - resultado.fallos} prendas etiquetadas{resultado.fallos > 0 ? `; ${resultado.fallos} no se pudieron (puedes reintentarlo)` : ''}.
        </p>
      )}
      {!trabajando && !resultado && pendientes > 0 && (
        <p className="text-sm text-tenue">Mira la foto de cada prenda y propone color, temporada, abrigo, formalidad y largo. No toca lo que hayas editado tú.</p>
      )}
    </div>
  )
}
