import { useId, useLayoutEffect, useRef, useState } from 'react'
import { aFraccion, esPosicionEnPixeles } from '../lib/outfits'
import { distancia, escalaDePellizco, limitarEscala, siguienteTamano } from '../lib/estadoPrenda'
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

function PrendaArrastrable({ cp, index, maxZ, setMaxZ, onGuardarEstado, onSobreCuerpo, soloLectura = false, ancho = 720 }) {
  const [pos, setPos] = useState({ x: cp.pos_x ?? 40, y: cp.pos_y ?? Math.min(20 + index * 7, 70) })
  const [ranura, setRanura] = useState(cp.ranura || null)
  const [zIndex, setZIndex] = useState(cp.z_index ?? 1)
  const [arrastrando, setArrastrando] = useState(false)
  const posRef = useRef(pos)
  const zRef = useRef(zIndex)
  const offset = useRef({ x: 0, y: 0 })
  const nodo = useRef(null)
  const [escala, setEscala] = useState(limitarEscala(cp.escala ?? 1))
  const [porDentro, setPorDentro] = useState(Boolean(cp.por_dentro))
  const escalaRef = useRef(escala)
  // Gestos: dedos apoyados, pellizco en curso y estado previo por si un segundo dedo cancela el arrastre.
  const punteros = useRef(new Map())
  const modo = useRef(null) // null | 'pendiente' | 'arrastre' | 'pellizco' | 'esperando'
  const previa = useRef(null)
  const pellizco = useRef(null)
  const ultimoToque = useRef(null)

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

  const extra = (sobre = {}) => ({ escala: escalaRef.current, por_dentro: porDentro, ...sobre })

  // Una prenda no se mueve al tocarla: espera a que el puntero se desplace de verdad.
  // Así un toque, un doble toque o un pellizco no la mueven ni la sacan del maniquí.
  const alBajar = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* sin captura, va igual */ }

    if (punteros.current.size >= 2 && ranura) {
      // Segundo dedo sobre una prenda puesta: pellizco (si ya se había empezado a arrastrar, se deshace).
      ultimoToque.current = null
      if (modo.current === 'arrastre' && previa.current) {
        const p = previa.current
        setRanura(p.ranura); setZIndex(p.zIndex); zRef.current = p.zIndex
        posRef.current = p.pos; setPos(p.pos); setArrastrando(false); onSobreCuerpo?.(false)
      }
      const [a, b] = [...punteros.current.values()]
      pellizco.current = { distancia: distancia(a, b), escala: escalaRef.current }
      modo.current = 'pellizco'
      return
    }
    if (punteros.current.size >= 2) {
      ultimoToque.current = null
      if (modo.current === 'pendiente') modo.current = 'esperando'
      return
    }

    previa.current = { ranura, zIndex, pos: posRef.current }
    modo.current = 'pendiente'
    pellizco.current = { x: e.clientX, y: e.clientY }
  }

  const empezarArrastre = (e) => {
    ultimoToque.current = null
    modo.current = 'arrastre'
    const cont = e.currentTarget.parentElement.getBoundingClientRect()
    const tam = cont.width * TAMANO_LIBRE

    // Una prenda puesta ocupa su hueco; al cogerla pasa a tamaño suelto,
    // centrada bajo el dedo para que no pegue un salto.
    if (ranura) offset.current = { x: tam / 2, y: tam / 2 }
    else offset.current = {
      x: e.clientX - cont.left - e.currentTarget.offsetLeft,
      y: e.clientY - cont.top - e.currentTarget.offsetTop,
    }
    const nueva = posicionDesde(e, cont)
    posRef.current = nueva
    setPos(nueva)
    setRanura(null)

    const nuevoZ = maxZ + 1
    zRef.current = nuevoZ
    setZIndex(nuevoZ)
    setMaxZ(nuevoZ)
    setArrastrando(true)
    vibrar(12)
  }

  const alMover = (e) => {
    if (punteros.current.has(e.pointerId)) punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (modo.current === 'pellizco') {
      if (punteros.current.size < 2) return
      const [a, b] = [...punteros.current.values()]
      const nueva = escalaDePellizco(pellizco.current.escala, pellizco.current.distancia, distancia(a, b))
      escalaRef.current = nueva
      setEscala(nueva)
      return
    }
    if (modo.current === 'pendiente') {
      const inicio = pellizco.current
      if (Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) < 8) return
      empezarArrastre(e)
      return
    }
    if (modo.current !== 'arrastre') return
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
    if (!punteros.current.has(e.pointerId)) return
    punteros.current.delete(e.pointerId)
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* ya no estaba */ }

    const cancelado = e.type === 'pointercancel'
    if (cancelado) ultimoToque.current = null

    if (modo.current === 'pellizco') {
      // Al soltar un dedo se guarda la escala; el que queda no mueve nada.
      if (punteros.current.size < 2) {
        const capa = RANURAS[ranura]?.capa ?? zRef.current
        onGuardarEstado(cp.conjunto_id, cp.prenda_id, 0, 0, capa, ranura, extra())
        modo.current = punteros.current.size ? 'esperando' : null
      }
      return
    }
    if (modo.current === 'esperando') {
      if (punteros.current.size === 0) modo.current = null
      return
    }
    if (modo.current === 'pendiente') {
      // Un toque sin mover. Dos seguidos cambian el tamaño entre pequeño, mediano y grande.
      modo.current = null
      if (cancelado) return
      if (ultimoToque.current !== null && e.timeStamp - ultimoToque.current < 320) {
        ultimoToque.current = null
        const nueva = siguienteTamano(escalaRef.current)
        escalaRef.current = nueva
        setEscala(nueva)
        if (ranura) {
          onGuardarEstado(cp.conjunto_id, cp.prenda_id, 0, 0, RANURAS[ranura].capa, ranura, extra({ escala: nueva }))
        } else {
          onGuardarEstado(cp.conjunto_id, cp.prenda_id, posRef.current.x, posRef.current.y, zRef.current, null, extra({ escala: nueva }))
        }
        vibrar(12)
      } else {
        ultimoToque.current = e.timeStamp
      }
      return
    }
    if (modo.current !== 'arrastre') return
    if (punteros.current.size > 0 && !cancelado) return
    modo.current = cancelado && punteros.current.size ? 'esperando' : null
    setArrastrando(false)
    onSobreCuerpo?.(false)

    if (cancelado) {
      const p = previa.current
      if (p) {
        setRanura(p.ranura); setZIndex(p.zIndex); zRef.current = p.zIndex
        posRef.current = p.pos; setPos(p.pos)
      }
      return
    }

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
      onGuardarEstado(cp.conjunto_id, cp.prenda_id, 0, 0, capa, elegida, extra())
      vibrar(8)
      return
    }

    onGuardarEstado(cp.conjunto_id, cp.prenda_id, posRef.current.x, posRef.current.y, zRef.current, null, extra())
  }

  function alternarPorDentro() {
    ultimoToque.current = null
    const nuevo = !porDentro
    setPorDentro(nuevo)
    onGuardarEstado(cp.conjunto_id, cp.prenda_id, 0, 0, RANURAS.torso.capa, ranura, extra({ por_dentro: nuevo }))
    vibrar(12)
  }

  // Por dentro, la camiseta pasa por detrás del pantalón: él tapa lo que sobra por abajo.
  const capaVisible = ranura === 'torso' && porDentro ? 0 : zIndex

  const estilo = ranura
    ? {
        left: `${RANURAS[ranura].x}%`,
        top: `${RANURAS[ranura].y}%`,
        width: `${RANURAS[ranura].w}%`,
        height: `${RANURAS[ranura].h}%`,
        zIndex: capaVisible + 20,
        ...(ranura === 'accesorio' && escala !== 1 && { transform: `scale(${escala})` }),
      }
    : {
        // Hasta medir el lienzo, una posición antigua se pinta en píxeles.
        ...(esPosicionEnPixeles(pos.x, pos.y)
          ? { left: `${pos.x}px`, top: `${pos.y}px` }
          : { left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }),
        width: `${TAMANO_LIBRE * 100}%`,
        height: `${TAMANO_LIBRE * 100}%`,
        zIndex: zIndex + 20,
        ...(escala !== 1 && { transform: `scale(${escala})` }),
      }

  return (
    <div
      ref={nodo}
      onPointerDown={soloLectura ? undefined : alBajar}
      onPointerMove={soloLectura ? undefined : alMover}
      onPointerUp={soloLectura ? undefined : alSoltar}
      onPointerCancel={soloLectura ? undefined : alSoltar}
      style={{ ...estilo, touchAction: soloLectura ? 'auto' : 'none' }}
      // El hueco no capta toques: los recibe la prenda visible (o el hueco si aún no está puesta) y burbujean aquí.
      className={`pointer-events-none absolute flex select-none items-center justify-center ${
        soloLectura ? '' : arrastrando ? 'cursor-grabbing' : 'cursor-grab'
      } ${ranura && !arrastrando ? 'transition-[left,top,width,height] duration-200 ease-suave' : ''}`}
      title={ranura ? `Imantada: ${RANURAS[ranura].etiqueta}` : undefined}
    >
      <PrendaAjustada
        url={cp.prendas.imagen_url}
        ancho={ancho}
        ranura={ranura}
        textos={[cp.prendas.nombre, cp.prendas.categorias?.nombre, cp.prendas.categorias?.tipos?.nombre]}
        largo={cp.prendas.largo}
        escala={escala}
        porDentro={ranura === 'torso' && porDentro}
        interactiva={!soloLectura}
      />
      {ranura === 'torso' && !soloLectura && !arrastrando && (
        // Fuera del hueco para no tapar la camiseta, pero dentro del lienzo (64 % + botón < 100 %).
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={alternarPorDentro}
          aria-pressed={porDentro}
          aria-label={porDentro ? 'Sacar la camiseta por fuera' : 'Meter la camiseta por dentro del pantalón'}
          className="pointer-events-auto absolute left-full ml-1 bottom-1 z-10 min-w-11 h-11 flex items-center justify-center whitespace-nowrap"
        >
          <span className="px-2 py-0.5 rounded-full border border-linea bg-superficie/90 text-tinta text-[11px] font-semibold leading-4">
            {porDentro ? 'Por dentro' : 'Por fuera'}
          </span>
        </button>
      )}
    </div>
  )
}

/**
 * `soloLectura`: el outfit se ve vestido pero no se puede arrastrar (propuestas, vistas previas).
 * `ampliado`: en las tarjetas se recorta el aire de los lados para que el outfit se vea mayor.
 */
export default function LienzoOutfit({ conjunto, onGuardarEstado, soloLectura = false, ampliado = false, ancho = 720 }) {
  const prendas = (conjunto.conjunto_prenda || []).filter((cp) => cp.prendas)
  const [maxZ, setMaxZ] = useState(() => Math.max(10, ...prendas.map((cp) => cp.z_index || 0)))
  const [sobreCuerpo, setSobreCuerpo] = useState(false)

  return (
    <div
      data-sin-swipe={soloLectura ? undefined : ''}
      className={`relative z-0 w-full overflow-hidden bg-foto ${ampliado ? 'aspect-[5/6]' : 'aspect-square'}`}
    >
      {/* El escenario sigue siendo cuadrado y con las mismas medidas: en las
          tarjetas solo se recorta el aire de los lados. Las posiciones y
          escalas guardadas no cambian. */}
      <div className="absolute inset-0 flex justify-center">
        <div id={`lienzo-${conjunto.id}`} className="relative h-full aspect-square shrink-0 bg-foto">
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
              soloLectura={soloLectura}
              ancho={ancho}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
