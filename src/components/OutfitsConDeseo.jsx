import { useMemo } from 'react'
import { isoLocal } from '../lib/fechas'
import { esDelArmario } from '../lib/filtros'
import { RANURAS } from '../lib/maniqui'
import { huecoDe, sugerirOutfits } from '../lib/sugerir'
import { usePrendas } from '../lib/almacen'
import LienzoOutfit from './LienzoOutfit'

function comoConjunto(outfit) {
  return {
    id: `deseo-${outfit.clave}`,
    conjunto_prenda: Object.values(outfit.piezas).filter(Boolean).map((p) => {
      const ranura = huecoDe(p)
      return { conjunto_id: 'deseo', prenda_id: p.id, ranura, z_index: RANURAS[ranura].capa, pos_x: 0, pos_y: 0, prendas: p }
    }),
  }
}

/** Cómo quedaría algo que quieres comprar con lo que ya tienes. */
export default function OutfitsConDeseo({ deseo }) {
  const { prendas, cargando } = usePrendas()
  const armario = useMemo(() => (prendas || []).filter(esDelArmario), [prendas])

  const outfits = useMemo(() => {
    if (cargando) return []
    // Sin clima ni descanso: aquí solo importa cómo quedan juntas las piezas.
    return sugerirOutfits([...armario, { ...deseo, deseada: true }], {
      clima: { temp: 18 }, hoy: isoLocal(new Date()), fijadas: [deseo.id], n: 4, descanso: 0,
    })
  }, [armario, deseo, cargando])
  const conjuntos = useMemo(() => outfits.map(comoConjunto), [outfits])

  return (
    <div className="flex flex-col gap-4 text-left">
      <h2 className="titulo-hoja">{deseo.nombre} con lo que ya tienes</h2>
      {cargando && <div role="status" aria-label="Preparando" className="esqueleto aspect-square max-w-xs w-full mx-auto" />}
      {!cargando && outfits.length === 0 && (
        <p className="py-6 text-center text-tenue">Con lo que tienes no sale un conjunto completo. Hace falta al menos una prenda de arriba y otra de abajo (o un vestido).</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {conjuntos.map((c, i) => (
          <figure key={c.id} className="m-0 rounded-xl border border-linea bg-superficie overflow-hidden [content-visibility:auto] [contain-intrinsic-size:auto_220px]">
            <LienzoOutfit conjunto={c} soloLectura />
            <figcaption className="px-2 py-1.5 text-sm font-semibold">Opción {i + 1}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
