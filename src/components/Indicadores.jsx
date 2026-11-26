import { useEffect, useRef, useState } from 'react'
import { resumenCarga } from '../lib/cargaMasiva'
import { useCargaMasiva } from '../lib/cargaMasivaApp'
import { colaOffline, useConexion } from '../lib/offline'

export function PantallaCarga() {
  return (
    <div className="h-dvh grid place-items-center bg-papel">
      <div role="status" aria-label="Cargando" className="esqueleto h-10 w-40" />
    </div>
  )
}

// Pastilla flotante mientras hay fotos preparándose o por revisar: abre la hoja de subida masiva.
export function IndicadorCarga({ oculto, onAbrir }) {
  const items = useCargaMasiva()
  useEffect(() => {
    // Con fotos sin guardar, el navegador avisa antes de cerrar la pestaña.
    if (items.length === 0) return undefined
    const avisar = (e) => { e.preventDefault() }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [items.length])
  if (items.length === 0 || oculto) return null
  const r = resumenCarga(items)
  return (
    <button onClick={onAbrir} className="aparece fixed z-40 left-1/2 -translate-x-1/2 bottom-24 md:bottom-6 min-h-11 px-4 rounded-full bg-tinta text-papel text-sm font-semibold shadow-(--sombra)">
      {r.activas > 0 ? `Preparando fotos · ${r.terminadas}/${r.total}` : `${r.listas} ${r.listas === 1 ? 'prenda' : 'prendas'} por revisar`}
    </button>
  )
}

// «Sin conexión» y cuántos cambios esperan a enviarse. Al volver la red se envían solos.
export function IndicadorConexion({ mostrarToast }) {
  const { enLinea, pendientes } = useConexion()
  const [enviando, setEnviando] = useState(false)
  const aviso = useRef(mostrarToast)
  aviso.current = mostrarToast

  useEffect(() => colaOffline.suscribirDescartes((n) => {
    aviso.current(`${n} ${n === 1 ? 'cambio' : 'cambios'} no se ${n === 1 ? 'pudo' : 'pudieron'} guardar y se ${n === 1 ? 'ha' : 'han'} descartado`, 'error')
  }), [])

  useEffect(() => {
    // La cola es de esta cuenta: se lee al entrar y se vacía al volver la red.
    let vivo = true
    const sincronizar = async () => {
      if (colaOffline.cuantas() === 0) return
      setEnviando(true)
      const r = await colaOffline.vaciar()
      if (!vivo) return
      setEnviando(false)
      if (r.enviadas > 0) aviso.current(`${r.enviadas} ${r.enviadas === 1 ? 'cambio sincronizado' : 'cambios sincronizados'}`, 'exito')
    }
    colaOffline.recargar()
    sincronizar()
    window.addEventListener('online', sincronizar)
    return () => { vivo = false; window.removeEventListener('online', sincronizar) }
  }, [])

  if (enLinea && pendientes === 0) return null
  return (
    <p role="status" className="aparece fixed z-50 left-1/2 -translate-x-1/2 top-[max(0.5rem,env(safe-area-inset-top))] mt-1 px-3 min-h-8 flex items-center rounded-full bg-tinta text-papel text-xs font-semibold shadow-(--sombra) pointer-events-none">
      {!enLinea ? 'Sin conexión' : enviando ? 'Enviando cambios…' : 'Cambios por enviar'}
      {pendientes > 0 && ` · ${pendientes} por enviar`}
    </p>
  )
}
