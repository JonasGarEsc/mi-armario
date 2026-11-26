const FILA = 28
const ANCHO = 320
const ETIQUETA = 96

/**
 * Barras horizontales en SVG propio (sin librerías). Usa los colores del tema, así
 * funciona en claro y oscuro. `colores` (opcional): { etiqueta: '#rrggbb' }.
 */
export default function GraficoBarras({ titulo, datos, colores = {} }) {
  if (datos.length === 0) return null
  const max = Math.max(...datos.map((d) => d.valor))
  const total = datos.reduce((s, d) => s + d.valor, 0)
  const resumen = datos.map((d) => `${d.etiqueta}: ${d.valor}`).join(', ')

  return (
    <figure className="m-0">
      <figcaption className="etiqueta">{titulo}</figcaption>
      <svg viewBox={`0 0 ${ANCHO} ${datos.length * FILA}`} role="img" aria-label={`${titulo}. ${resumen}`} className="w-full h-auto block">
        {datos.map((d, i) => {
          const ancho = Math.max(3, (d.valor / max) * (ANCHO - ETIQUETA - 78))
          const y = i * FILA
          return (
            <g key={d.etiqueta}>
              <text x="0" y={y + 18} fontSize="12" style={{ fill: 'var(--tinta)' }}>
                {d.etiqueta.length > 14 ? `${d.etiqueta.slice(0, 13)}…` : d.etiqueta}
              </text>
              <rect x={ETIQUETA} y={y + 5} width={ancho} height={FILA - 10} rx="4" style={{ fill: colores[d.etiqueta] || 'var(--acento)' }} />
              <text x={ETIQUETA + ancho + 6} y={y + 18} fontSize="12" style={{ fill: 'var(--tenue)' }}>
                {d.valor}{total > 0 && ` · ${Math.round((d.valor / total) * 100)}%`}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
