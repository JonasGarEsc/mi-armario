import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { ciudadGuardada, coordenadasDeCiudad } from '../lib/clima'
import { activar, desactivar, estado as estadoAviso } from '../lib/push'
import { vibrar } from '../lib/vibrar'

const CLAVE_HORA = 'armario_aviso_hora'
const HORAS = Array.from({ length: 24 }, (_, hora) => hora)
const horaTexto = (hora) => `${String(hora).padStart(2, '0')}:00`

function leerHora() {
  try {
    const hora = Number(localStorage.getItem(CLAVE_HORA) ?? 8)
    return Number.isInteger(hora) && hora >= 0 && hora <= 23 ? hora : 8
  } catch {
    return 8
  }
}

function guardarHora(hora) {
  try { localStorage.setItem(CLAVE_HORA, String(hora)) } catch { /* modo privado */ }
}

/** Coordenadas de la ciudad guardada para que el aviso mire el tiempo. */
async function sitioDeLaCiudad() {
  try {
    const ciudad = ciudadGuardada()
    if (!ciudad) return {}
    const c = await coordenadasDeCiudad(ciudad)
    return c ? { lat: c.lat, lon: c.lon } : {}
  } catch {
    return {}
  }
}

/** Interruptor del aviso por la mañana, con su hora y el motivo si no se puede. */
export default function AvisoDiario({ mostrarToast }) {
  const [estado, setEstado] = useState(null)
  const [hora, setHora] = useState(leerHora)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let vivo = true
    estadoAviso().then((e) => { if (vivo) setEstado(e) })
    return () => { vivo = false }
  }, [])

  async function alternar() {
    if (!estado || guardando) return
    setGuardando(true)
    vibrar(20)
    if (estado.suscrito) {
      const r = await desactivar(supabase)
      if (r.ok) {
        setEstado({ ...estado, suscrito: false, motivo: null })
        mostrarToast?.('Aviso de la mañana desactivado', 'exito')
      } else {
        mostrarToast?.(r.motivo || 'No se pudo desactivar el aviso', 'error')
      }
    } else {
      const r = await activar(supabase, { hora, ...(await sitioDeLaCiudad()) })
      if (r.ok) {
        setEstado({ ...estado, suscrito: true, permiso: 'granted', motivo: null })
        mostrarToast?.('Aviso de la mañana activado', 'exito')
      } else {
        setEstado(await estadoAviso())
        mostrarToast?.(r.motivo || 'No se pudo activar el aviso', 'error')
      }
    }
    setGuardando(false)
  }

  async function cambiarHora(e) {
    const nueva = Number(e.target.value)
    setHora(nueva)
    guardarHora(nueva)
    // Si ya estaba activo, se actualiza la hora guardada en el servidor.
    if (!estado?.suscrito || guardando) return
    setGuardando(true)
    const r = await activar(supabase, { hora: nueva, ...(await sitioDeLaCiudad()) })
    if (!r.ok) mostrarToast?.(r.motivo || 'No se pudo cambiar la hora', 'error')
    setGuardando(false)
  }

  const puedeActivar = Boolean(estado?.soportado) && estado?.permiso !== 'denied'
  const bloqueado = guardando || Boolean(estado) && !estado.suscrito && !puedeActivar

  return (
    <div className="flex flex-col gap-2 pt-3 mt-1 border-t border-linea">
      <h3 className="text-base font-semibold">Aviso por la mañana</h3>
      {!estado && <div role="status" aria-label="Comprobando los avisos" className="esqueleto h-12" />}
      {estado && (
        <>
          <button
            type="button"
            role="switch"
            aria-checked={estado.suscrito}
            disabled={bloqueado}
            onClick={alternar}
            className="boton boton-secundario justify-between!"
          >
            {estado.suscrito ? 'Activado' : 'Desactivado'}
            <span aria-hidden="true" className={`w-11 h-6 rounded-full p-0.5 ${estado.suscrito ? 'bg-acento' : 'bg-tenue'}`}>
              <span className={`block w-5 h-5 rounded-full bg-superficie transition-transform duration-200 ${estado.suscrito ? 'translate-x-5' : ''}`} />
            </span>
          </button>
          <div>
            <label htmlFor="horaAviso" className="etiqueta">Hora del aviso</label>
            <select id="horaAviso" value={hora} onChange={cambiarHora} disabled={guardando || !estado.soportado} className="campo">
              {HORAS.map((h) => <option key={h} value={h}>{horaTexto(h)}</option>)}
            </select>
          </div>
          <p className="text-sm text-tenue">
            {estado.motivo || 'Te avisamos con la propuesta del día. Si hay ciudad guardada, también mira el tiempo.'}
          </p>
        </>
      )}
    </div>
  )
}
