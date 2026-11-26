import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { isoLocal } from '../lib/fechas'
import { cuandoFue, desdeSemana, guardarResuelto, leerResueltos, outfitsSinUso, usosPorAnadir } from '../lib/uso'
import { vibrar } from '../lib/vibrar'
import Miniatura from './Miniatura'

/**
 * Aviso discreto al abrir la app: «¿Te pusiste el outfit de ayer?». Sí anota el uso de
 * todas sus prendas; «Cambié algo» deja elegir cuáles; No lo descarta sin anotar nada.
 */
export default function AvisoUso({ version = 0, onCambio, mostrarToast }) {
  const [pendientes, setPendientes] = useState([])
  const [trabajando, setTrabajando] = useState(false)
  const hoy = isoLocal(new Date())

  useEffect(() => {
    let vivo = true
    const inicio = desdeSemana(hoy)
    if (inicio >= hoy) { setPendientes([]); return undefined }

    async function buscar() {
      const [{ data: conjuntos }, { data: usos }] = await Promise.all([
        supabase.from('conjuntos')
          .select('id, nombre, fecha, conjunto_prenda(prenda_id, prendas(id, nombre, imagen_url))')
          .not('semana_id', 'is', null).gte('fecha', inicio).lt('fecha', hoy),
        supabase.from('usos').select('prenda_id, fecha').gte('fecha', inicio).lt('fecha', hoy),
      ])
      if (vivo) setPendientes(outfitsSinUso(conjuntos || [], usos || [], hoy, leerResueltos()))
    }
    buscar()
    return () => { vivo = false }
  }, [version, hoy])

  const siguiente = useCallback(() => setPendientes((p) => p.slice(1)), [])
  const outfit = pendientes[0]
  if (!outfit) return null

  const prendas = outfit.conjunto_prenda.map((cp) => cp.prendas).filter(Boolean)

  async function respondiSi() {
    setTrabajando(true)
    const { data: usos } = await supabase.from('usos').select('prenda_id, fecha').eq('fecha', outfit.fecha)
    const nuevos = usosPorAnadir(outfit.conjunto_prenda.map((cp) => cp.prenda_id), outfit.fecha, usos || [])
    const { error } = nuevos.length ? await supabase.from('usos').insert(nuevos) : { error: null }
    setTrabajando(false)
    if (error) return mostrarToast('No se pudo anotar el uso', 'error')
    guardarResuelto(outfit.id)
    vibrar(20)
    mostrarToast('Anotado', 'exito')
    siguiente()
  }

  function respondiNo() {
    guardarResuelto(outfit.id)
    vibrar(10)
    siguiente()
  }

  return (
    <section role="region" aria-label="Registro de uso" className="aparece shrink-0 mx-4 md:mx-8 mt-2 rounded-xl bg-lamina p-3 flex flex-col gap-2 max-w-6xl md:self-center md:w-[calc(100%-4rem)]">
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2 shrink-0" aria-hidden="true">
          {prendas.slice(0, 3).map((p) => (
            <span key={p.id} className="w-9 h-9 rounded-full bg-foto border-2 border-lamina p-1 overflow-hidden">
              <Miniatura url={p.imagen_url} alt="" className="w-full h-full object-contain" />
            </span>
          ))}
        </div>
        <p className="flex-1 min-w-0 text-sm font-semibold leading-5">
          ¿Te pusiste «{outfit.nombre}» {cuandoFue(outfit.fecha, hoy)}?
          {pendientes.length > 1 && <span className="font-normal text-tenue"> (+{pendientes.length - 1} más)</span>}
        </p>
      </div>
      <div className="flex gap-2">
        <button onClick={respondiSi} disabled={trabajando} className="boton boton-primario flex-1 min-h-11! px-3!">Sí</button>
        <button onClick={respondiNo} disabled={trabajando} className="boton boton-secundario bg-superficie! flex-1 min-h-11! px-3!">No</button>
        <button onClick={() => onCambio(outfit)} disabled={trabajando} className="boton boton-secundario bg-superficie! flex-[1.6] min-h-11! px-3!">Cambié algo</button>
      </div>
    </section>
  )
}
