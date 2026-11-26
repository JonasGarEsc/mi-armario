import { useEffect, useRef } from 'react'
import { desdeISO, etiquetaDia, etiquetaRango } from '../lib/fechas'
import { columnasDeResumen } from '../lib/resumenMaleta'
import LienzoOutfit from './LienzoOutfit'

/**
 * Imagen resumen de una maleta: todos sus outfits en cuadrícula, con fechas.
 * Se pinta fuera de pantalla solo mientras se genera la imagen; usa colores fijos
 * para que salga igual en tema claro y oscuro.
 */
export default function ResumenMaleta({ maleta, conjuntos, onListo }) {
  const ref = useRef(null)
  const columnas = columnasDeResumen(conjuntos.length)
  const prendas = new Set(conjuntos.flatMap((c) => (c.conjunto_prenda || []).map((cp) => cp.prenda_id))).size
  const cuando = maleta.fecha_inicio ? etiquetaRango(maleta.fecha_inicio, maleta.fecha_fin || maleta.fecha_inicio) : ''

  useEffect(() => { if (ref.current) onListo(ref.current) }, [onListo])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: 'fixed', left: '-10000px', top: 0, width: 760, padding: 36, boxSizing: 'border-box',
        background: '#f6f6f7', color: '#17181b', fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <h2 style={{ margin: 0, fontSize: 38, lineHeight: 1.15, fontWeight: 800 }}>{maleta.nombre}</h2>
      <p style={{ margin: '6px 0 24px', fontSize: 20, color: '#585c66' }}>
        {[maleta.destino, cuando].filter(Boolean).join(' · ')}{(maleta.destino || cuando) && ' · '}
        {conjuntos.length} {conjuntos.length === 1 ? 'outfit' : 'outfits'} · {prendas} {prendas === 1 ? 'prenda' : 'prendas'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columnas}, 1fr)`, gap: 14 }}>
        {conjuntos.map((c) => (
          <figure key={c.id} style={{ margin: 0, background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #e0e2e6' }}>
            <LienzoOutfit conjunto={{ ...c, id: `res-${c.id}` }} soloLectura />
            <figcaption style={{ padding: '8px 10px', fontSize: 16, fontWeight: 700, lineHeight: 1.25 }}>
              {c.fecha && <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#585c66' }}>{etiquetaDia(desdeISO(c.fecha))}</span>}
              {c.nombre}
            </figcaption>
          </figure>
        ))}
      </div>
      <p style={{ margin: '22px 0 0', fontSize: 14, color: '#8a8d94', textAlign: 'right' }}>Perletta</p>
    </div>
  )
}
