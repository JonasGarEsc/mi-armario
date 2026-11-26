import { useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { esDelArmario } from '../lib/filtros'
import { guardarResuelto, usosPorAnadir } from '../lib/uso'
import { vibrar } from '../lib/vibrar'
import { etiquetaDia, desdeISO } from '../lib/fechas'
import { usePrendas } from '../lib/almacen'
import Miniatura from './Miniatura'

/** «Cambié algo»: eliges qué prendas te pusiste de verdad ese día (parten marcadas las del outfit). */
export default function ConfirmarUso({ outfit, mostrarToast, onHecho }) {
  const { prendas, cargando } = usePrendas()
  const [elegidas, setElegidas] = useState(() => outfit.conjunto_prenda.map((cp) => cp.prenda_id))
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)

  const delArmario = useMemo(() => (prendas || []).filter(esDelArmario), [prendas])
  const alternar = (id) => { vibrar(8); setElegidas((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id])) }
  const visibles = delArmario.filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  async function guardar() {
    setGuardando(true)
    const { data: usos } = await supabase.from('usos').select('prenda_id, fecha').eq('fecha', outfit.fecha)
    const nuevos = usosPorAnadir(elegidas, outfit.fecha, usos || [])
    const { error } = nuevos.length ? await supabase.from('usos').insert(nuevos) : { error: null }
    setGuardando(false)
    if (error) return mostrarToast('No se pudo anotar el uso', 'error')
    guardarResuelto(outfit.id)
    vibrar([30, 30])
    mostrarToast(elegidas.length ? 'Anotado' : 'Descartado', 'exito')
    onHecho()
  }

  return (
    <div className="flex flex-col gap-3 text-left min-h-0">
      <h2 className="titulo-hoja">¿Qué te pusiste el {etiquetaDia(desdeISO(outfit.fecha))}?</h2>
      <input type="search" aria-label="Buscar prendas" placeholder="Buscar prendas" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="campo" />

      {cargando ? (
        <div role="status" aria-label="Cargando" className="esqueleto h-40 w-full" />
      ) : (
        <ul className="rounded-xl border border-linea divide-y divide-linea overflow-y-auto max-h-[45dvh]">
          {visibles.map((p) => (
            <li key={p.id}>
              <label className="flex items-center gap-3 px-3 py-2 min-h-12 cursor-pointer">
                <input type="checkbox" checked={elegidas.includes(p.id)} onChange={() => alternar(p.id)} className="w-5 h-5 shrink-0 accent-acento" />
                <span className="flex-1 min-w-0 truncate text-sm">{p.nombre}</span>
                <span className="w-9 h-9 shrink-0 rounded bg-foto p-0.5"><Miniatura url={p.imagen_url} alt="" className="w-full h-full object-contain" /></span>
              </label>
            </li>
          ))}
          {visibles.length === 0 && <li className="p-4 text-center text-tenue text-sm">Nada coincide con la búsqueda.</li>}
        </ul>
      )}

      <p className="text-sm text-tenue">{elegidas.length} {elegidas.length === 1 ? 'prenda elegida' : 'prendas elegidas'}</p>
      <button onClick={guardar} disabled={guardando || prendas === null} className="boton boton-primario w-full">{guardando ? 'Guardando…' : 'Anotar'}</button>
    </div>
  )
}
