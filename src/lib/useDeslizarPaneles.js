import { useEffect, useLayoutEffect, useRef } from 'react'
import { curvaAsentamiento, destinoDelGesto } from './gestos'

// Curva de asentamiento parecida a la de iOS: arranca rápido y frena suave.
export const CURVA_IOS = 'cubic-bezier(0.22, 1, 0.36, 1)'
const DURACION = 380

/** ¿Está el elemento dentro de algo que se desplaza en horizontal (filas de chips, carruseles)? */
function enDesplazamientoHorizontal(el, limite) {
  for (let n = el; n && n !== limite; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return true
  }
  return false
}

/**
 * Paneles en fila que siguen al dedo, afinado para que no haya ni un corte:
 *  - Eventos táctiles nativos: en cuanto el gesto es horizontal se bloquea el
 *    scroll vertical, así iOS no se queda el gesto a medias.
 *  - El dedo mueve la pista en el mismo evento (sin esperar a otro fotograma)
 *    y sin pasar por React.
 *  - Solo píxeles en el transform (sin calc ni %): Safari lo anima en el
 *    compositor, fuera del hilo principal.
 *  - Al soltar, la animación arranca a la misma velocidad que llevaba el
 *    dedo: no hay frenazo ni acelerón al levantarlo.
 *  - Mientras se asienta, React no hace nada pesado: `onPrevisualizar` avisa
 *    al instante (para cosas baratas como la barra de pestañas) y
 *    `onCambiar` cuando la animación ya ha terminado.
 *  - La pista vive siempre en su propia capa (will-change).
 *
 * Devuelve la ref de la pista. Su padre es la zona que escucha el dedo.
 */
export function useDeslizarPaneles({ indice, total, onCambiar, onPrevisualizar }) {
  const pista = useRef(null)
  const visual = useRef(indice) // panel en el que está (o al que va) la pista
  const enReact = useRef(indice) // sección que la app tiene por activa
  enReact.current = indice
  const totalRef = useRef(total)
  totalRef.current = total
  const avisos = useRef({ onCambiar, onPrevisualizar })
  avisos.current = { onCambiar, onPrevisualizar }
  const aviso = useRef(0)

  const ancho = () => pista.current?.parentElement?.clientWidth || 0

  /** Coloca la pista en el panel `i` desplazada `px`, animando o no. */
  const colocar = (i, px = 0, duracion = 0, curva = CURVA_IOS) => {
    const el = pista.current
    if (!el) return
    const w = ancho()
    el.style.transition = duracion ? `transform ${duracion}ms ${curva}` : 'none'
    el.style.transform = w
      ? `translate3d(${-i * w + px}px, 0, 0)`
      : `translate3d(${(-i * 100) / totalRef.current}%, 0, 0)`
  }

  // Cambio desde fuera (pestañas): se anima hasta el panel. Si ya está ahí
  // porque lo ha llevado el dedo, no hay nada que mover.
  const primera = useRef(true)
  useLayoutEffect(() => {
    const el = pista.current
    if (!el) return
    el.style.willChange = 'transform'
    if (visual.current !== indice) clearTimeout(aviso.current) // manda la pestaña tocada
    if (primera.current || visual.current !== indice) colocar(indice, 0, primera.current ? 0 : DURACION)
    visual.current = indice
    primera.current = false
  }, [indice, total])

  useEffect(() => {
    const el = pista.current
    const zona = el?.parentElement
    if (!zona) return
    let gesto = null

    // Al girar el móvil o cambiar de tamaño, recolocar sin animación.
    const observador = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => { if (!gesto) colocar(visual.current) })
      : null
    observador?.observe(zona)

    const posicionActual = () => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41

    const empezar = (e) => {
      if (e.touches.length !== 1) { gesto = null; return }
      if (e.target.closest?.('[data-sin-swipe], input, textarea, select')) return
      // Un gesto sobre una fila que se desplaza (chips, miniaturas) es para ella, no para cambiar de pantalla.
      if (enDesplazamientoHorizontal(e.target, zona)) { gesto = null; return }
      const t = e.touches[0]
      gesto = { x0: t.clientX, y0: t.clientY, dx: 0, previo: 0, horizontal: null, muestras: [[e.timeStamp, t.clientX]] }
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
        gesto.ancho = ancho() || 1
        clearTimeout(aviso.current)
        // Si aún se estaba asentando, se coge al vuelo desde donde está ahora.
        gesto.previo = posicionActual() + visual.current * gesto.ancho
      }

      e.preventDefault() // horizontal: que no se desplace la lista a la vez
      const i = visual.current
      const n = totalRef.current
      let d = t.clientX - gesto.x0 + gesto.previo
      // Resistencia elástica al tirar más allá del primer o el último panel.
      if ((i === 0 && d > 0) || (i === n - 1 && d < 0)) d = d / (2.5 + Math.abs(d) / 120)
      gesto.dx = d
      gesto.muestras.push([e.timeStamp, t.clientX])
      if (gesto.muestras.length > 5) gesto.muestras.shift()
      colocar(i, d)
    }

    const terminar = (e) => {
      if (!gesto) return
      const g = gesto
      gesto = null
      if (!g.horizontal) return

      const i = visual.current
      const [t0, x0] = g.muestras[0]
      const [t1, x1] = g.muestras[g.muestras.length - 1]
      // Solo cuenta el final del gesto: si el dedo se paró antes de soltar,
      // la velocidad es cero.
      const reciente = e.timeStamp - t1 < 60
      const velocidad = reciente ? (x1 - x0) / Math.max(1, t1 - t0) : 0
      const destino = e.type === 'touchcancel' ? i : destinoDelGesto(i, totalRef.current, g.dx, velocidad, g.ancho)

      // Recorrido que falta y curva que sale a la velocidad del dedo.
      const falta = (destino - i) * -g.ancho - g.dx
      const { duracion, curva } = curvaAsentamiento(falta, velocidad)

      visual.current = destino
      colocar(destino, 0, duracion, curva)
      clearTimeout(aviso.current)
      if (destino !== enReact.current) {
        avisos.current.onPrevisualizar?.(destino)
        aviso.current = setTimeout(() => avisos.current.onCambiar(destino), duracion + 40)
      }
    }

    zona.addEventListener('touchstart', empezar, { passive: true })
    zona.addEventListener('touchmove', mover, { passive: false })
    zona.addEventListener('touchend', terminar, { passive: true })
    zona.addEventListener('touchcancel', terminar, { passive: true })
    return () => {
      observador?.disconnect()
      clearTimeout(aviso.current)
      zona.removeEventListener('touchstart', empezar)
      zona.removeEventListener('touchmove', mover)
      zona.removeEventListener('touchend', terminar)
      zona.removeEventListener('touchcancel', terminar)
    }
  }, [])

  return pista
}
