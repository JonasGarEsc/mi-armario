import { useId, useLayoutEffect, useRef, useState } from 'react'
import { aFraccion, esPosicionEnPixeles } from '../lib/outfits'
import { RANURAS, dentroDelManiqui, inferirRanura, ranuraMasCercana } from '../lib/maniqui'
import { vibrar } from '../lib/vibrar'
import PrendaAjustada from './PrendaAjustada'

const TAMANO_LIBRE = 0.28 // 28 % del ancho del escenario

// Silueta de maniquí de escaparate con proporciones humanas (8 cabezas).
// Las medidas que usa la ropa para vestirlo están en CUERPO (lib/maniqui).
// Cadera y piernas son una sola forma, sin escalones entre una y otras.
const TORSO =
  'M47.4 17.6C45 18.6 42.2 18.7 40.4 19.6 39 20.3 38.9 22.4 39.6 24.2L41 27.6C41.4 30 42.6 31.8 42.8 34L43 37H57L57.2 34C57.4 31.8 58.6 30 59 27.6L60.4 24.2C61.1 22.4 61 20.3 59.6 19.6 57.8 18.7 55 18.6 52.6 17.6Z'
const PIERNAS =
  'M42.7 32.5C42.9 35.5 41 38.5 41 42.5 41 46.5 41.4 50 41.9 55 42.4 59.5 43 63 43.1 66 43.2 70 42.7 74 43.4 79L44.4 88.6H47.3L47.9 79C48.3 74 47.5 70 47.6 66 47.8 61 49.2 55 49.6 50.5L50 50 50.4 50.5C50.8 55 52.2 61 52.4 66 52.5 70 51.7 74 52.1 79L52.7 88.6H55.6L56.6 79C57.3 74 56.8 70 56.9 66 57 63 57.6 59.5 58.1 55 58.6 50 59 46.5 59 42.5 59 38.5 57.1 35.5 57.3 32.5Z'
const PIE = 'M44.4 88c-.8 2.5-2.4 4.8-2.8 6.4.6 1 4.6 1.1 6.1.2.2-2.1-.1-4.6-.3-6.6Z'
const BRAZO = 'M40.2 19.8C39.2 20.4 38.6 21.6 38.2 23.4L36.4 33.6C36 36.5 35.3 41.5 34.6 46.4L36.7 46.7C37.5 42 38.3 37 38.7 34.4L41 27.4Z'
const MANO = 'M34.6 46.2c-.9 1.9-1.2 4.2-.6 5.8.6.9 2 .6 2.5-.5l.3-5Z'

function Maniqui({ resaltado = false }) {
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
          <path d={PIERNAS} />
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
      {/* Mientras arrastras una prenda encima, el maniquí se ilumina: al
          soltarla se imantará a su sitio. */}
      <use
        href={`#${cuerpo}`}
        strokeWidth={resaltado ? 1.8 : 0.6}
        strokeLinejoin="round"
        style={{
          fill: resaltado ? 'var(--acento)' : '#9d9386',
          stroke: resaltado ? 'var(--acento)' : '#9d9386',
          transition: 'stroke-width 150ms, fill 150ms, stroke 150ms',
        }}
      />
      <use href={`#${cuerpo}`} fill={`url(#${piel})`} />
    </svg>
  )
}

function PrendaArrastrable({ cp, index, maxZ, setMaxZ, onGuardarEstado, onSobreCuerpo }) {
  const [pos, setPos] = useState({ x: cp.pos_x ?? 40, y: cp.pos_y ?? Math.min(20 + index * 7, 70) })
  const [ranura, setRanura] = useState(cp.ranura || null)
  const [zIndex, setZIndex] = useState(cp.z_index ?? 1)
  const [arrastrando, setArrastrando] = useState(false)
  const posRef = useRef(pos)
  const zRef = useRef(zIndex)
  const offset = useRef({ x: 0, y: 0 })
  const nodo = useRef(null)

  // Posición antigua en píxeles: se pasa a fracción del lienzo al abrirla.
  useLayoutEffect(() => {
    const { x, y } = posRef.current
    const cont = nodo.current?.parentElement?.getBoundingClientRect()
    if (!esPosicionEnPixeles(x, y) || !cont?.width) return
    const nueva = aFraccion(x, y, cont.width, cont.height, cont.width * TAMANO_LIBRE)
    posRef.current = nueva
    setPos(nueva)
  }, [])

  // Del dedo (px) a la esquina de la prenda, en fracción del lienzo.
  const posicionDesde = (e, cont) =>
    aFraccion(
      e.clientX - cont.left - offset.current.x,
      e.clientY - cont.top - offset.current.y,
      cont.width,
      cont.height,
      cont.width * TAMANO_LIBRE,
    )

  const alBajar = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    const cont = e.currentTarget.parentElement.getBoundingClientRect()
    const rect = e.currentTarget.getBoundingClientRect()
    const tam = cont.width * TAMANO_LIBRE

    // Una prenda puesta ocupa su hueco; al cogerla pasa a tamaño suelto,
    // centrada bajo el dedo para que no pegue un salto.
    if (ranura) offset.current = { x: tam / 2, y: tam / 2 }
    else offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    const nueva = posicionDesde(e, cont)
    posRef.current = nueva
    setPos(nueva)
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
    const nueva = posicionDesde(e, cont)
    posRef.current = nueva
    setPos(nueva)
    onSobreCuerpo?.(sobreElManiqui(e, cont))
  }

  // Lo que decide si se imanta es dónde está el dedo, no la foto.
  const sobreElManiqui = (e, cont) =>
    dentroDelManiqui(
      ((e.clientX - cont.left) / cont.width) * 100,
      ((e.clientY - cont.top) / cont.height) * 100,
    )

  const alSoltar = (e) => {
    if (!arrastrando) return
    setArrastrando(false)
    onSobreCuerpo?.(false)
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* ya no estaba */ }

    const cont = e.currentTarget.parentElement.getBoundingClientRect()
    const dedoX = ((e.clientX - cont.left) / cont.width) * 100
    const dedoY = ((e.clientY - cont.top) / cont.height) * 100

    const prenda = cp.prendas
    const inferida = inferirRanura(
      prenda?.categorias?.nombre,
      prenda?.categorias?.tipos?.nombre,
      prenda?.nombre,
    )
    const elegida = dentroDelManiqui(dedoX, dedoY)
      ? (inferida || ranuraMasCercana(dedoX, dedoY))
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
        // Hasta medir el lienzo, una posición antigua se pinta en píxeles.
        ...(esPosicionEnPixeles(pos.x, pos.y)
          ? { left: `${pos.x}px`, top: `${pos.y}px` }
          : { left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }),
        width: `${TAMANO_LIBRE * 100}%`,
        height: `${TAMANO_LIBRE * 100}%`,
        zIndex: zIndex + 20,
      }

  return (
    <div
      ref={nodo}
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
        textos={[cp.prendas.nombre, cp.prendas.categorias?.nombre, cp.prendas.categorias?.tipos?.nombre]}
      />
    </div>
  )
}

export default function LienzoOutfit({ conjunto, onGuardarEstado }) {
  const prendas = (conjunto.conjunto_prenda || []).filter((cp) => cp.prendas)
  const [maxZ, setMaxZ] = useState(() => Math.max(10, ...prendas.map((cp) => cp.z_index || 0)))
  const [sobreCuerpo, setSobreCuerpo] = useState(false)

  return (
    <div
      id={`lienzo-${conjunto.id}`}
      data-sin-swipe
      className="relative z-0 w-full aspect-square overflow-hidden bg-foto"
    >
      <Maniqui resaltado={sobreCuerpo} />
      {prendas.map((cp, index) => (
        <PrendaArrastrable
          key={cp.prenda_id}
          cp={cp}
          index={index}
          maxZ={maxZ}
          setMaxZ={setMaxZ}
          onGuardarEstado={onGuardarEstado}
          onSobreCuerpo={setSobreCuerpo}
        />
      ))}
    </div>
  )
}
