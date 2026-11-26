import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import {
  anadirExtras, guardarExtraHecho, guardarMarcada, leerChecklist, limpiarTexto, quitarExtra, yaEsta,
} from './checklistMaleta'

/**
 * Lista de la maleta con actualizaciones optimistas: la casilla cambia al instante y,
 * si el servidor no lo acepta, vuelve a como estaba.
 */
export function useChecklistMaleta(maletaId, refresco = 0) {
  const [estado, setEstado] = useState({ extras: [], marcadas: [], local: false, listo: false })
  const ref = useRef(estado)
  ref.current = estado

  const recargar = useCallback(async () => {
    if (!maletaId) { setEstado({ extras: [], marcadas: [], local: false, listo: false }); return }
    const datos = await leerChecklist(supabase, maletaId)
    setEstado({ ...datos, listo: true })
  }, [maletaId])

  useEffect(() => {
    let vivo = true
    setEstado({ extras: [], marcadas: [], local: false, listo: false })
    if (!maletaId) return undefined
    leerChecklist(supabase, maletaId).then((d) => { if (vivo) setEstado({ ...d, listo: true }) })
    return () => { vivo = false }
  }, [maletaId, refresco])

  async function alternarPrenda(prendaId) {
    const antes = ref.current
    const hecho = !antes.marcadas.includes(prendaId)
    const marcadas = hecho ? [...antes.marcadas, prendaId] : antes.marcadas.filter((x) => x !== prendaId)
    setEstado({ ...antes, marcadas })
    const ok = await guardarMarcada(supabase, maletaId, prendaId, hecho, { local: antes.local, marcadas })
    if (!ok) setEstado((e) => ({ ...e, marcadas: antes.marcadas }))
    return ok
  }

  async function alternarExtra(id) {
    const antes = ref.current
    const extras = antes.extras.map((e) => (e.id === id ? { ...e, hecho: !e.hecho } : e))
    setEstado({ ...antes, extras })
    const ok = await guardarExtraHecho(supabase, maletaId, extras.find((e) => e.id === id), { local: antes.local, extras })
    if (!ok) setEstado((e) => ({ ...e, extras: antes.extras }))
  }

  async function anadir(textos) {
    const antes = ref.current
    const lista = (Array.isArray(textos) ? textos : [textos]).map(limpiarTexto).filter(Boolean)
    if (lista.length === 0) return 0
    const nuevos = await anadirExtras(supabase, maletaId, lista, { local: antes.local, extras: antes.extras })
    if (nuevos === null) return -1
    if (nuevos.length) setEstado((e) => ({ ...e, extras: [...e.extras, ...nuevos] }))
    return nuevos.length
  }

  async function quitar(id) {
    const antes = ref.current
    const extra = antes.extras.find((e) => e.id === id)
    const extras = antes.extras.filter((e) => e.id !== id)
    setEstado({ ...antes, extras })
    const ok = await quitarExtra(supabase, maletaId, extra, { local: antes.local, extras })
    if (!ok) setEstado((e) => ({ ...e, extras: antes.extras }))
  }

  return { ...estado, alternarPrenda, alternarExtra, anadir, quitar, recargar, yaEsta: (t) => yaEsta(estado.extras, t) }
}
