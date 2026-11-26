import { useEffect, useLayoutEffect, useRef } from 'react'
import { destinoDelGesto } from './gestos'

// Curva de asentamiento parecida a la de iOS: arranca rápido y frena suave.
export const CURVA_IOS = 'cubic-bezier(0.22, 1, 0.36, 1)'
const TRANSICION = `transform 380ms ${CURVA_IOS}`

/**
 * Paneles en fila que siguen al dedo. Mientras arrastras, la pista se mueve
 * tocando el estilo directamente (sin pasar por React en cada fotograma, que
 * es lo que da tirones a 120 Hz); al soltar se asienta en el panel que toca
 * según la distancia y la velocidad del gesto.
 *
 * Devuelve la ref de la pista (el elemento que se desplaza). Su padre es la
 * zona que escucha el dedo.
 */
export function useDeslizarPaneles({ indice, total, onCambiar }) {
  const pista = useRef(null)
  const actual = useRef({ indice, total, onCambiar })
  actual.current = { indice, total, onCambiar }

  const colocar = (el, i, desplazamiento = 0, animar = true) => {
    el.style.transition = animar ? TRANSICION : 'none'
    el.style.transform = desplazamiento
      ? `translate3d(calc(${(-i * 100) / actual.current.total}% + ${desplazamiento}px), 0, 0)`
      : `translate3d(${(-i * 100) / actual.current.total}%, 0, 0)`
  }

  // Posición de reposo (antes de pintar, para no ver un salto al cargar).
  const primera = useRef(true)
  useLayoutEffect(() => {
    if (!pista.current) return
    colocar(pista.current, indice, 0, !primera.current)
    primera.current = false
  }, [indice, total])

  useEffect(() => {
    const el = pista.current
    const zona = el?.parentElement
    if (!zona) return
    let gesto = null

    const bajar = (e) => {
      // El ratón no desliza paneles; tampoco se arrastra desde el lienzo de un
      // outfit ni desde un campo de texto.
      if (e.pointerType === 'mouse' || !e.isPrimary) return
      if (e.target.closest?.('[data-sin-swipe], input, textarea, select')) return
      gesto = {
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        dx: 0,
        horizontal: null,
        muestras: [[e.timeStamp, e.clientX]],
        ancho: zona.clientWidth || 1,
      }
    }

    const mover = (e) => {
      if (!gesto || e.pointerId !== gesto.id) return
      const dx = e.clientX - gesto.x0
      const dy = e.clientY - gesto.y0

      if (gesto.horizontal === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        // En vertical manda el scroll del navegador: se suelta el gesto.
        if (Math.abs(dx) < Math.abs(dy) * 1.15) {
          gesto = null
          return
        }
        gesto.horizontal = true
        gesto.x0 = e.clientX // sin salto: se empieza a mover desde aquí
        el.style.willChange = 'transform'
        try { zona.setPointerCapture(e.pointerId) } catch { /* sin captura, va igual */ }
      }

      const { indice: i, total: n } = actual.current
      let d = e.clientX - gesto.x0
      // Resistencia elástica al tirar más allá del primer o el último panel.
      if ((i === 0 && d > 0) || (i === n - 1 && d < 0)) d = d / (2.5 + Math.abs(d) / 120)
      gesto.dx = d
      gesto.muestras.push([e.timeStamp, e.clientX])
      if (gesto.muestras.length > 6) gesto.muestras.shift()
      colocar(el, i, d, false)
    }

    const soltar = (e, cancelado = false) => {
      if (!gesto || e.pointerId !== gesto.id) return
      const g = gesto
      gesto = null
      if (!g.horizontal) return

      const { indice: i, total: n, onCambiar: cambiar } = actual.current
      const [t0, x0] = g.muestras[0]
      const [t1, x1] = g.muestras[g.muestras.length - 1]
      const velocidad = (x1 - x0) / Math.max(1, t1 - t0)
      const destino = cancelado ? i : destinoDelGesto(i, n, g.dx, velocidad, g.ancho)

      colocar(el, destino)
      el.style.willChange = ''
      if (destino !== i) cambiar(destino)
    }
    const cancelar = (e) => soltar(e, true)

    zona.addEventListener('pointerdown', bajar, { passive: true })
    zona.addEventListener('pointermove', mover, { passive: true })
    zona.addEventListener('pointerup', soltar, { passive: true })
    zona.addEventListener('pointercancel', cancelar, { passive: true })
    return () => {
      zona.removeEventListener('pointerdown', bajar)
      zona.removeEventListener('pointermove', mover)
      zona.removeEventListener('pointerup', soltar)
      zona.removeEventListener('pointercancel', cancelar)
    }
  }, [])

  return pista
}
