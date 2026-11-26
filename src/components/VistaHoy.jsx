import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { usePrendas } from '../lib/almacen'
import { climaDeHoy } from '../lib/clima'
import { isoLocal } from '../lib/fechas'
import { useConexion } from '../lib/offline'
import { comoConjunto, guardarOutfitDeHoy, outfitDelDia } from '../lib/propuestas'
import { sugerirOutfits } from '../lib/sugerir'
import { claveDeOutfit } from '../lib/valoraciones'
import { useValoraciones } from '../lib/useValoraciones'
import { vibrar } from '../lib/vibrar'
import BotonesValoracion from './BotonesValoracion'
import LienzoOutfit from './LienzoOutfit'

/** Pantalla «Hoy»: el tiempo, el outfit ya planeado y una propuesta con valoración. */
export default function VistaHoy({ mostrarToast, onHecho }) {
  const { prendas, cargando: cargandoPrendas } = usePrendas()
  const { enLinea } = useConexion()
  const { valoraciones, cargando: cargandoValoraciones, valorar } = useValoraciones()
  const [tiempo, setTiempo] = useState('cargando') // 'cargando' | null | { clima, ciudad }
  const [planificado, setPlanificado] = useState('cargando') // 'cargando' | null | conjunto
  const [descartadas, setDescartadas] = useState(() => new Set())
  const [propuesta, setPropuesta] = useState(null)
  const [guardando, setGuardando] = useState(false)
  // La propuesta en pantalla no cambia al valorarla: así se puede deshacer el
  // toque. El mapa nuevo se usa para la siguiente propuesta.
  const valoracionesRef = useRef(valoraciones)
  valoracionesRef.current = valoraciones

  const hoy = isoLocal(new Date())
  const clima = tiempo && tiempo !== 'cargando' ? tiempo.clima : null

  useEffect(() => {
    let vivo = true
    // Sin red solo se puede usar el tiempo que ya estaba guardado.
    climaDeHoy({ sinRed: !enLinea }).then((t) => { if (vivo) setTiempo(t) })
    return () => { vivo = false }
  }, [enLinea])

  useEffect(() => {
    if (!enLinea) { setPlanificado(null); return undefined }
    let vivo = true
    outfitDelDia(supabase, hoy)
      .then((c) => { if (vivo) setPlanificado(c) })
      .catch(() => { if (vivo) setPlanificado(null) })
    return () => { vivo = false }
  }, [hoy, enLinea])

  useEffect(() => {
    const mapa = valoracionesRef.current
    if (cargandoPrendas || !clima || !mapa) { setPropuesta(null); return }
    // Si ya hay algo planificado, la propuesta nueva no lo repite.
    const mantener = planificado && planificado !== 'cargando'
      ? [(planificado.conjunto_prenda || []).map((cp) => cp.prenda_id)]
      : []
    const [nueva] = sugerirOutfits(prendas, {
      clima, hoy, n: 1, descartar: [...descartadas], mantener, valoraciones: mapa,
    })
    setPropuesta(nueva || null)
  }, [prendas, cargandoPrendas, clima, hoy, descartadas, planificado, cargandoValoraciones])

  const conjuntoPropuesta = useMemo(() => (propuesta ? comoConjunto(propuesta) : null), [propuesta])
  const cargando = cargandoPrendas || tiempo === 'cargando' || cargandoValoraciones || (enLinea && planificado === 'cargando')
  const sinTiempo = tiempo !== 'cargando' && !clima

  const clavePropuesta = propuesta ? claveDeOutfit(propuesta.ids) : null
  const valorPropuesta = clavePropuesta ? valoraciones?.get(clavePropuesta) ?? 0 : 0
  const hayDescartadas = descartadas.size > 0 || (valoraciones ? [...valoraciones.values()].includes(-1) : false)

  function reintentarTiempo() {
    setTiempo('cargando')
    climaDeHoy({ forzar: true, sinRed: !enLinea }).then(setTiempo)
  }

  function otra() {
    if (!propuesta) return
    vibrar(10)
    const mantener = planificado && planificado !== 'cargando'
      ? [(planificado.conjunto_prenda || []).map((cp) => cp.prenda_id)]
      : []
    const [nueva] = sugerirOutfits(prendas, {
      clima, hoy, n: 1, descartar: [...descartadas, propuesta.clave], mantener, valoraciones,
    })
    if (!nueva) {
      mostrarToast?.('No tengo otra combinación distinta con esas prendas', 'info')
      return
    }
    setDescartadas((prev) => new Set(prev).add(propuesta.clave))
  }

  async function meLoPongo() {
    if (!propuesta || guardando) return
    setGuardando(true)
    try {
      const { yaEsta } = await guardarOutfitDeHoy(supabase, propuesta, hoy)
      vibrar([40, 40])
      mostrarToast?.(yaEsta ? 'Ese outfit ya estaba en tu semana; anotado el uso' : 'Outfit de hoy guardado en tu semana', 'exito')
      onHecho?.()
    } catch (e) {
      mostrarToast?.(e.message || 'No se pudo guardar', 'error')
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 text-left">
      <h2 className="titulo-hoja">Hoy</h2>

      {!enLinea && (
        <p role="status" className="rounded-xl bg-lamina px-4 py-3 text-sm text-tenue">
          Sin conexión. Se muestra lo que ya estaba guardado.
        </p>
      )}

      {cargando && (
        <div role="status" aria-label="Preparando el día" className="flex flex-col gap-4">
          <div className="esqueleto h-5 w-48" />
          <div className="esqueleto aspect-square max-w-xs w-full mx-auto" />
        </div>
      )}

      {!cargando && sinTiempo && (
        <div className="flex flex-col gap-3">
          <p className="text-tenue">
            {enLinea
              ? 'No he podido saber el tiempo de hoy. Revisa tu ciudad en Ajustes.'
              : 'Sin conexión y sin un tiempo guardado que enseñar.'}
          </p>
          <button onClick={reintentarTiempo} className="boton boton-secundario self-start">Reintentar</button>
        </div>
      )}

      {!cargando && clima && (
        <p className="text-tenue -mt-2">
          {`Hoy${tiempo?.ciudad ? ` en ${tiempo.ciudad}` : ''}: ${clima.min}° – ${clima.max}°`}
          {clima.lluvia && ' · lluvia'}
        </p>
      )}

      {!cargando && planificado && planificado !== 'cargando' && (
        <article aria-label="Outfit planificado para hoy" className="rounded-xl border border-linea bg-superficie overflow-hidden">
          <div className="px-4 pt-3 pb-1 flex items-center justify-between gap-2">
            <p className="font-semibold">Ya planeado para hoy</p>
            <span className="text-sm text-tenue truncate">{planificado.nombre}</span>
          </div>
          <LienzoOutfit conjunto={planificado} soloLectura ampliado />
        </article>
      )}

      {!cargando && clima && propuesta && conjuntoPropuesta && (
        <article aria-label="Propuesta de hoy" className="rounded-xl border border-linea bg-superficie overflow-hidden">
          <LienzoOutfit conjunto={conjuntoPropuesta} soloLectura ampliado />
          <div className="p-3 flex flex-col gap-3">
            {clavePropuesta && (
              <BotonesValoracion
                valor={valorPropuesta}
                onValorar={(v) => valorar(clavePropuesta, v, mostrarToast)}
                etiqueta="la propuesta de hoy"
              />
            )}
            <div className="flex gap-2">
              <button onClick={otra} disabled={guardando} className="boton boton-secundario flex-1">Otra propuesta</button>
              <button onClick={meLoPongo} disabled={guardando} className="boton boton-primario flex-1">
                {guardando ? 'Guardando…' : 'Me lo pongo'}
              </button>
            </div>
          </div>
        </article>
      )}

      {!cargando && clima && !propuesta && (
        <div className="py-8 text-center text-tenue">
          <p className="font-semibold text-tinta">
            {prendas.length === 0 ? 'Tu armario todavía está vacío' : 'No encuentro un conjunto completo'}
          </p>
          <p className="mt-1">
            {hayDescartadas
              ? 'No me quedan combinaciones que no hayas descartado. Añade prendas o quita algún «no me gusta».'
              : 'Hace falta al menos una prenda de arriba y otra de abajo (o un vestido).'}
          </p>
        </div>
      )}
    </div>
  )
}
