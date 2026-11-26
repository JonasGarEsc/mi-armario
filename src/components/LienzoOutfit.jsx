import { useId, useRef, useState } from 'react'
import { limitarPosicion } from '../lib/outfits'
import { RANURAS, dentroDelManiqui, inferirRanura, objetivoDeRanura, ranuraMasCercana } from '../lib/maniqui'
import { vibrar } from '../lib/vibrar'
import PrendaAjustada from './PrendaAjustada'

const TAMANO_LIBRE = 0.28 // 28 % del ancho del escenario

function Maniqui() {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const madera = `${uid}-madera`
  const sombra = `${uid}-sombra`

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <defs>
        <linearGradient id={madera} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d3b48c" />
          <stop offset="0.25" stopColor="#ecd7ba" />
          <stop offset="0.5" stopColor="#fbf1e2" />
          <stop offset="0.78" stopColor="#e7d0b0" />
          <stop offset="1" stopColor="#c6a276" />
        </linearGradient>
        <radialGradient id={sombra}>
          <stop offset="0" stopColor="#000000" stopOpacity="0.16" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="50" cy="95.7" rx="15" ry="3.4" fill={`url(#${sombra})`} />

      {/* Piernas */}
      <g fill="none" strokeLinecap="round">
        <g stroke="#b9976e" strokeWidth="5.2">
          <path d="M46.2 48.4 45.2 68" />
          <path d="M53.8 48.4 54.8 68" />
        </g>
        <g stroke={`url(#${madera})`} strokeWidth="4.4">
          <path d="M46.2 48.4 45.2 68" />
          <path d="M53.8 48.4 54.8 68" />
        </g>
        <g stroke="#b9976e" strokeWidth="4.4">
          <path d="M45.2 68 44.8 88" />
          <path d="M54.8 68 55.2 88" />
        </g>
        <g stroke={`url(#${madera})`} strokeWidth="3.6">
          <path d="M45.2 68 44.8 88" />
          <path d="M54.8 68 55.2 88" />
        </g>
      </g>

      {/* Pies */}
      <g fill={`url(#${madera})`} stroke="#b9976e" strokeWidth="0.45" strokeLinejoin="round">
        <path d="M44.8 87.6C43.5 89.6 42.4 92.2 42.6 94c1.3 1 3.6.8 4.8-.4l-1.2-5.8Z" />
        <path d="M55.2 87.6c1.3 2 2.4 4.6 2.2 6.4-1.3 1-3.6.8-4.8-.4l1.2-5.8Z" />
      </g>

      {/* Brazos */}
      <g fill="none" strokeLinecap="round">
        <g stroke="#b9976e" strokeWidth="4.3">
          <path d="M41.2 23.6 38 38.8" />
          <path d="M58.8 23.6 62 38.8" />
        </g>
        <g stroke={`url(#${madera})`} strokeWidth="3.5">
          <path d="M41.2 23.6 38 38.8" />
          <path d="M58.8 23.6 62 38.8" />
        </g>
        <g stroke="#b9976e" strokeWidth="3.7">
          <path d="M38 38.8 36.2 51.6" />
          <path d="M62 38.8 63.8 51.6" />
        </g>
        <g stroke={`url(#${madera})`} strokeWidth="2.9">
          <path d="M38 38.8 36.2 51.6" />
          <path d="M62 38.8 63.8 51.6" />
        </g>
      </g>

      {/* Manos */}
      <g fill={`url(#${madera})`} stroke="#b9976e" strokeWidth="0.4" strokeLinejoin="round">
        <path d="M36.2 51.4c-.7 1.8-1 3.8-.7 5.4.8.6 1.8.3 2.3-.6l-.5-4.9Z" />
        <path d="M63.8 51.4c.7 1.8 1 3.8.7 5.4-.8.6-1.8.3-2.3-.6l.5-4.9Z" />
      </g>

      {/* Torso */}
      <path
        d="M50 21.3c-2.8 0-5.8.8-8.8 2.3-.3 3.2.8 8.2 2.2 13.2h13.2c1.4-5 2.5-10 2.2-13.2-3-1.5-6-2.3-8.8-2.3Z"
        fill={`url(#${madera})`}
        stroke="#b9976e"
        strokeWidth="0.45"
        strokeLinejoin="round"
      />
      {/* Cintura */}
      <rect x="45.4" y="36.6" width="9.2" height="2" rx="1" fill="#c7aa82" stroke="#b9976e" strokeWidth="0.4" />
      {/* Pelvis */}
      <path
        d="M44.2 38.2h11.6l1.5 5.4c-.8 2.7-3.4 4.8-7.3 6-3.9-1.2-6.5-3.3-7.3-6Z"
        fill={`url(#${madera})`}
        stroke="#b9976e"
        strokeWidth="0.45"
        strokeLinejoin="round"
      />

      {/* Cuello */}
      <path
        d="M47.5 15.2h5l-.2 5.6h-4.6Z"
        fill={`url(#${madera})`}
        stroke="#b9976e"
        strokeWidth="0.4"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="20.3" r="2.05" fill={`url(#${madera})`} stroke="#b9976e" strokeWidth="0.4" />

      {/* Cabeza */}
      <ellipse cx="50" cy="9.6" rx="5.3" ry="6.3" fill={`url(#${madera})`} stroke="#b9976e" strokeWidth="0.45" />
      <ellipse cx="48.6" cy="8.5" rx="1.5" ry="3.1" fill="#ffffff" opacity="0.16" />

      {/* Articulaciones */}
      <g fill={`url(#${madera})`} stroke="#b9976e" strokeWidth="0.4">
        <circle cx="41.2" cy="23.6" r="2.6" />
        <circle cx="58.8" cy="23.6" r="2.6" />
        <circle cx="38" cy="38.8" r="2.25" />
        <circle cx="62" cy="38.8" r="2.25" />
        <circle cx="36.2" cy="51.6" r="1.8" />
        <circle cx="63.8" cy="51.6" r="1.8" />
        <circle cx="46.2" cy="48.4" r="2.4" />
        <circle cx="53.8" cy="48.4" r="2.4" />
        <circle cx="45.2" cy="68" r="2.2" />
        <circle cx="54.8" cy="68" r="2.2" />
        <circle cx="44.8" cy="88" r="1.7" />
        <circle cx="55.2" cy="88" r="1.7" />
      </g>
      <g fill="#a98a62" opacity="0.5">
        <circle cx="41.2" cy="23.6" r="0.5" />
        <circle cx="58.8" cy="23.6" r="0.5" />
        <circle cx="38" cy="38.8" r="0.45" />
        <circle cx="62" cy="38.8" r="0.45" />
        <circle cx="36.2" cy="51.6" r="0.4" />
        <circle cx="63.8" cy="51.6" r="0.4" />
        <circle cx="46.2" cy="48.4" r="0.45" />
        <circle cx="53.8" cy="48.4" r="0.45" />
        <circle cx="45.2" cy="68" r="0.45" />
        <circle cx="54.8" cy="68" r="0.45" />
        <circle cx="44.8" cy="88" r="0.35" />
        <circle cx="55.2" cy="88" r="0.35" />
      </g>
    </svg>
  )
}

function PrendaArrastrable({ cp, index, maxZ, setMaxZ, onGuardarEstado }) {
  const [pos, setPos] = useState({ x: cp.pos_x ?? 40, y: cp.pos_y ?? Math.min(20 + index * 7, 70) })
  const [ranura, setRanura] = useState(cp.ranura || null)
  const [zIndex, setZIndex] = useState(cp.z_index ?? 1)
  const [arrastrando, setArrastrando] = useState(false)
  const posRef = useRef(pos)
  const zRef = useRef(zIndex)
  const offset = useRef({ x: 0, y: 0 })

  const alBajar = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    const cont = e.currentTarget.parentElement.getBoundingClientRect()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = rect.left - cont.left
    const y = rect.top - cont.top

    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    posRef.current = { x, y }
    setPos({ x, y })
    setRanura(null)

    const nuevoZ = maxZ + 1
    zRef.current = nuevoZ
    setZIndex(nuevoZ)
    setMaxZ(nuevoZ)
    setArrastrando(true)

    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* sin captura, va igual */ }
    vibrar(12)
  }

  const alMover = (e) => {
    if (!arrastrando) return
    const cont = e.currentTarget.parentElement.getBoundingClientRect()
    const tam = cont.width * TAMANO_LIBRE
    const nueva = limitarPosicion(
      e.clientX - cont.left - offset.current.x,
      e.clientY - cont.top - offset.current.y,
      cont.width,
      cont.height,
      tam,
    )
    posRef.current = nueva
    setPos(nueva)
  }

  const alSoltar = (e) => {
    if (!arrastrando) return
    setArrastrando(false)
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* ya no estaba */ }

    const cont = e.currentTarget.parentElement.getBoundingClientRect()
    const tam = cont.width * TAMANO_LIBRE
    const centroX = ((posRef.current.x + tam / 2) / cont.width) * 100
    const centroY = ((posRef.current.y + tam / 2) / cont.height) * 100

    const prenda = cp.prendas
    const inferida = inferirRanura(
      prenda?.categorias?.nombre,
      prenda?.categorias?.tipos?.nombre,
      prenda?.nombre,
    )
    const elegida = dentroDelManiqui(centroX, centroY)
      ? (inferida || ranuraMasCercana(centroX, centroY))
      : null

    if (elegida) {
      const capa = RANURAS[elegida].capa
      zRef.current = capa
      setRanura(elegida)
      setZIndex(capa)
      onGuardarEstado(cp.conjunto_id, cp.prenda_id, 0, 0, capa, elegida)
      vibrar(8)
      return
    }

    onGuardarEstado(cp.conjunto_id, cp.prenda_id, posRef.current.x, posRef.current.y, zRef.current, null)
  }

  const estilo = ranura
    ? {
        left: `${RANURAS[ranura].x}%`,
        top: `${RANURAS[ranura].y}%`,
        width: `${RANURAS[ranura].w}%`,
        height: `${RANURAS[ranura].h}%`,
        zIndex: zIndex + 20,
      }
    : {
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${TAMANO_LIBRE * 100}%`,
        height: `${TAMANO_LIBRE * 100}%`,
        zIndex: zIndex + 20,
      }

  const zona = ranura ? objetivoDeRanura(ranura) : null

  return (
    <div
      onPointerDown={alBajar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
      style={{ ...estilo, touchAction: 'none' }}
      className={`absolute flex select-none items-center justify-center ${
        arrastrando ? 'cursor-grabbing' : 'cursor-grab'
      } ${ranura && !arrastrando ? 'transition-[left,top,width,height] duration-200 ease-suave' : ''}`}
      title={ranura ? `Imantada: ${RANURAS[ranura].etiqueta}` : undefined}
    >
      <PrendaAjustada
        url={cp.prendas.imagen_url}
        ancho={720}
        aspecto={ranura ? RANURAS[ranura].w / RANURAS[ranura].h : 1}
        objetivo={zona}
        ajustar={Boolean(zona)}
      />
    </div>
  )
}

export default function LienzoOutfit({ conjunto, onGuardarEstado }) {
  const prendas = (conjunto.conjunto_prenda || []).filter((cp) => cp.prendas)
  const [maxZ, setMaxZ] = useState(() => Math.max(10, ...prendas.map((cp) => cp.z_index || 0)))

  return (
    <div
      id={`lienzo-${conjunto.id}`}
      data-sin-swipe
      className="relative z-0 w-full aspect-square overflow-hidden bg-foto"
    >
      <Maniqui />
      {prendas.map((cp, index) => (
        <PrendaArrastrable
          key={cp.prenda_id}
          cp={cp}
          index={index}
          maxZ={maxZ}
          setMaxZ={setMaxZ}
          onGuardarEstado={onGuardarEstado}
        />
      ))}
    </div>
  )
}
