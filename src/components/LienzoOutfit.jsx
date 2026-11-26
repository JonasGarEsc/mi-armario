import { useId, useRef, useState } from 'react'
import { limitarPosicion } from '../lib/outfits'
import { RANURAS, dentroDelManiqui, inferirRanura, ranuraMasCercana } from '../lib/maniqui'
import { vibrar } from '../lib/vibrar'
import PrendaAjustada from './PrendaAjustada'

const TAMANO_LIBRE = 0.28 // 28 % del ancho del escenario

// Silueta de maniquí de escaparate con proporciones humanas (8 cabezas).
// Las medidas que usa la ropa para vestirlo están en CUERPO (lib/maniqui).
const PIERNA = 'M40.6 43C40.6 50 42 57 43.3 66c.3 4-.5 8 .3 14l1 8.6h2.7l.6-8.6c.5-5-.5-10-.3-14 .6-7 2-13 2.2-18.5Z'
const PIE = 'M44.4 88c-.8 2.5-2.4 4.8-2.8 6.4.6 1 4.6 1.1 6.1.2.2-2.1-.1-4.6-.3-6.6Z'
const BRAZO = 'M39.8 19.8c-1.6.5-2.4 2.4-2.8 4.7l-2 9.7c-.4 1.8-1 7.8-1.8 12.2l2.4.3c1-4.7 2-10.2 2.6-12.2l3.4-8.5Z'
const MANO = 'M33.2 46.2c-.8 2.3-1 4.8-.2 6.2.8.8 2.2.2 2.6-1l.2-4.8Z'
const TORSO =
  'M47.4 17.6c-2.4 1-5.2 1.1-7 2-1.4.7-1.5 2.8-.8 4.6l1.5 3.3c.2 2.5 1.6 4.3 1.7 6 .1 2.5-2.4 4.9-2.5 8-.1 2.5.3 4.5 1.2 5.7l8.5 1.4 8.5-1.4c.9-1.2 1.3-3.2 1.2-5.7-.1-3.1-2.6-5.5-2.5-8 .1-1.7 1.5-3.5 1.7-6l1.5-3.3c.7-1.8.6-3.9-.8-4.6-1.8-.9-4.6-1-7-2Z'

function Maniqui() {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const piel = `${uid}-piel`
  const sombra = `${uid}-sombra`
  const cuerpo = `${uid}-cuerpo`
  const espejo = 'translate(100 0) scale(-1 1)'

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <defs>
        <linearGradient id={piel} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9c1b5" />
          <stop offset="0.3" stopColor="#e6dfd4" />
          <stop offset="0.55" stopColor="#f3eee6" />
          <stop offset="0.85" stopColor="#dcd3c6" />
          <stop offset="1" stopColor="#c2b8aa" />
        </linearGradient>
        <radialGradient id={sombra}>
          <stop offset="0" stopColor="#000000" stopOpacity="0.22" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        {/* Las piezas no llevan color: lo heredan de cada <use>, así el
            contorno se dibuja una vez por debajo y no quedan costuras. */}
        <g id={cuerpo}>
          <path d={PIERNA} />
          <path d={PIERNA} transform={espejo} />
          <path d={PIE} />
          <path d={PIE} transform={espejo} />
          <path d={TORSO} />
          <path d={BRAZO} />
          <path d={BRAZO} transform={espejo} />
          <path d={MANO} />
          <path d={MANO} transform={espejo} />
          <path d="M47.9 13h4.2l.5 5.5h-5.2Z" />
          <ellipse cx="50" cy="9" rx="4.3" ry="5.6" />
        </g>
      </defs>

      <ellipse cx="50" cy="95" rx="13" ry="2.6" fill={`url(#${sombra})`} />
      <use href={`#${cuerpo}`} fill="#9d9386" stroke="#9d9386" strokeWidth="0.9" strokeLinejoin="round" />
      <use href={`#${cuerpo}`} fill={`url(#${piel})`} />
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
        ranura={ranura}
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
