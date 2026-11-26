import { useRef, useState } from 'react'
import { limitarPosicion } from '../lib/outfits'
import { RANURAS, dentroDelManiqui, inferirRanura, ranuraMasCercana } from '../lib/maniqui'
import { vibrar } from '../lib/vibrar'
import Miniatura from './Miniatura'

const TAMANO_LIBRE = 0.28 // 28 % del ancho del escenario

function Maniqui() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full text-linea"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.75">
        <circle cx="50" cy="13" r="8" />
        <path d="M47 21v4m6-4v4" />
        <path d="M50 25c-7 0-13 2-17 5l2 22h30l2-22c-4-3-10-5-17-5z" />
        <path d="M32 30c-4 6-6 15-7 26l5 1c1-9 3-16 6-22M68 30c4 6 6 15 7 26l-5 1c-1-9-3-16-6-22" />
        <path d="M41 52l-2 16 2 18h6l2-20 2 20h6l2-18-2-16" />
        <path d="M37 88h9m8 0h9" />
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
      <Miniatura
        url={cp.prendas.imagen_url}
        ancho={720}
        alt=""
        className="pointer-events-none h-full w-full select-none object-contain drop-shadow-sm"
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
