import { useEffect, useLayoutEffect, useRef } from 'react'
import { destinoDelGesto } from './gestos'

// Curva de asentamiento parecida a la de iOS: arranca rápido y frena suave.
export const CURVA_IOS = 'cubic-bezier(0.22, 1, 0.36, 1)'
const DURACION = 380
const TRANSICION = `transform ${DURACION}ms ${CURVA_IOS}`

/**
 * Paneles en fila que siguen al dedo, pensado para que vaya fino a 120 Hz:
 *  - Eventos táctiles nativos: en cuanto el gesto es horizontal se bloquea el
 *    scroll vertical (los eventos de puntero no pueden), así iOS no se lo
 *    queda a medias y la pista no da tirones ni vuelve de golpe.
 *  - Durante el gesto no pasa nada por React: se toca el estilo de la pista,
 *    una vez por fotograma.
 *  - La pista vive siempre en su propia capa (will-change), para no tener que
 *    pintar las tres pantallas justo al empezar a arrastrar.
 *  - Al soltar, primero se anima y el cambio de sección se avisa a React al
 *    terminar: el re-renderizado no se come los primeros fotogramas.
 *
 * Devuelve la ref de la pista. Su padre es la zona que escucha el dedo.
 */
export function useDeslizarPaneles({ indice, total, onCambiar }) {
  const pista = useRef(null)
  const visual = useRef(indice) // panel en el que está (o al que va) la pista
  const avisar = useRef(onCambiar)
  avisar.current = onCambiar
  const totalRef = useRef(total)
  const aviso = useRef(0) // aviso pendiente a React tras un deslizamiento
  const enReact = useRef(indice) // la sección que React tiene por activa
  enReact.current = indice
  totalRef.current = total

  const colocar = (i, desplazamiento = 0, animar = true) => {
    const el = pista.current
    if (!el) return
    const base = (-i * 100) / totalRef.current
    el.style.transition = animar ? TRANSICION : 'none'
    el.style.transform = desplazamiento
      ? `translate3d(calc(${base}% + ${desplazamiento}px), 0, 0)`
      : `translate3d(${base}%, 0, 0)`
  }

  // Cambio desde fuera (pestañas): se anima hasta el panel. Si ya está ahí
  // porque lo ha llevado el dedo, no hay nada que mover.
  const primera = useRef(true)
  useLayoutEffect(() => {
    const el = pista.current
    if (!el) return
    el.style.willChange = 'transform'
    if (visual.current !== indice) clearTimeout(aviso.current) // manda la pestaña tocada
    if (primera.current || visual.current !== indice) colocar(indice, 0, !primera.current)
    visual.current = indice
    primera.current = false
  }, [indice, total])

  useEffect(() => {
    const zona = pista.current?.parentElement
    if (!zona) return
    let gesto = null
    let fotograma = 0

    const pintar = () => {
      fotograma = 0
      if (gesto?.horizontal) colocar(visual.current, gesto.dx, false)
    }

    const empezar = (e) => {
      if (e.touches.length !== 1) { gesto = null; return }
      if (e.target.closest?.('[data-sin-swipe], input, textarea, select')) return
      const t = e.touches[0]
      gesto = { x0: t.clientX, y0: t.clientY, dx: 0, previo: 0, horizontal: null, muestras: [[e.timeStamp, t.clientX]], ancho: zona.clientWidth || 1 }
    }

    const mover = (e) => {
      if (!gesto) return
      const t = e.touches[0]
      const dx = t.clientX - gesto.x0
      const dy = t.clientY - gesto.y0

      if (gesto.horizontal === null) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
        // Vertical, o el navegador ya está desplazando: manda el scroll.
        if (Math.abs(dx) < Math.abs(dy) * 1.1 || !e.cancelable) { gesto = null; return }
        gesto.horizontal = true
        gesto.x0 = t.clientX // empieza a moverse desde aquí, sin salto
        clearTimeout(aviso.current)
        // Si aún se estaba asentando, se coge al vuelo desde donde está ahora.
        const ahora = new DOMMatrixReadOnly(getComputedStyle(pista.current).transform).m41
        gesto.previo = ahora + visual.current * gesto.ancho
      }

      e.preventDefault() // horizontal: que no se desplace la lista a la vez
      const i = visual.current
      const n = totalRef.current
      let d = t.clientX - gesto.x0 + gesto.previo
      // Resistencia elástica al tirar más allá del primer o el último panel.
      if ((i === 0 && d > 0) || (i === n - 1 && d < 0)) d = d / (2.5 + Math.abs(d) / 120)
      gesto.dx = d
      gesto.muestras.push([e.timeStamp, t.clientX])
      if (gesto.muestras.length > 6) gesto.muestras.shift()
      if (!fotograma) fotograma = requestAnimationFrame(pintar)
    }

    const terminar = (e) => {
      if (!gesto) return
      const g = gesto
      gesto = null
      if (!g.horizontal) return
      cancelAnimationFrame(fotograma)
      fotograma = 0

      const i = visual.current
      const [t0, x0] = g.muestras[0]
      const [t1, x1] = g.muestras[g.muestras.length - 1]
      const velocidad = (x1 - x0) / Math.max(1, t1 - t0)
      const destino = e.type === 'touchcancel' ? i : destinoDelGesto(i, totalRef.current, g.dx, velocidad, g.ancho)

      visual.current = destino
      colocar(destino)
      clearTimeout(aviso.current)
      if (destino !== enReact.current) {
        // Cuando la curva ya ha hecho casi todo el recorrido; para entonces la
        // animación corre sola y el re-renderizado no la frena.
        aviso.current = setTimeout(() => avisar.current(destino), DURACION * 0.55)
      }
    }

    zona.addEventListener('touchstart', empezar, { passive: true })
    zona.addEventListener('touchmove', mover, { passive: false })
    zona.addEventListener('touchend', terminar, { passive: true })
    zona.addEventListener('touchcancel', terminar, { passive: true })
    return () => {
      cancelAnimationFrame(fotograma)
      clearTimeout(aviso.current)
      zona.removeEventListener('touchstart', empezar)
      zona.removeEventListener('touchmove', mover)
      zona.removeEventListener('touchend', terminar)
      zona.removeEventListener('touchcancel', terminar)
    }
  }, [])

  return pista
}
