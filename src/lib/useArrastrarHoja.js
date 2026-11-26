import { useEffect, useRef } from 'react'
import { cerrarHoja } from './gestos'
import { CURVA_IOS } from './useDeslizarPaneles'

/**
 * La hoja inferior sigue al dedo cuando se arrastra desde su asa. Al soltar,
 * se cierra si ha bajado bastante o se ha lanzado; si no, vuelve a su sitio.
 * Devuelve la ref del asa. `hoja` es la ref de la hoja que se mueve.
 */
export function useArrastrarHoja(hoja, onCerrar, activa) {
  const asa = useRef(null)
  const cerrar = useRef(onCerrar)
  cerrar.current = onCerrar

  useEffect(() => {
    const zona = asa.current
    if (!zona || !activa) return
    let gesto = null

    const bajar = (e) => {
      if (!e.isPrimary || !hoja.current) return
      gesto = { id: e.pointerId, y0: e.clientY, dy: 0, muestras: [[e.timeStamp, e.clientY]] }
      hoja.current.style.transition = 'none'
      hoja.current.style.willChange = 'transform'
      try { zona.setPointerCapture(e.pointerId) } catch { /* va igual */ }
    }

    const mover = (e) => {
      if (!gesto || e.pointerId !== gesto.id || !hoja.current) return
      const d = e.clientY - gesto.y0
      // Hacia arriba ofrece resistencia; hacia abajo va pegada al dedo.
      gesto.dy = d > 0 ? d : d / (3 + Math.abs(d) / 40)
      gesto.muestras.push([e.timeStamp, e.clientY])
      if (gesto.muestras.length > 6) gesto.muestras.shift()
      hoja.current.style.transform = `translate3d(0, ${gesto.dy}px, 0)`
    }

    const soltar = (e) => {
      if (!gesto || e.pointerId !== gesto.id || !hoja.current) return
      const g = gesto
      gesto = null
      const el = hoja.current
      const [t0, y0] = g.muestras[0]
      const [t1, y1] = g.muestras[g.muestras.length - 1]
      const velocidad = (y1 - y0) / Math.max(1, t1 - t0)
      el.style.willChange = ''
      if (cerrarHoja(g.dy, velocidad, el.offsetHeight)) {
        // Termina de bajar desde donde está el dedo.
        el.style.transition = `transform 260ms ${CURVA_IOS}`
        el.style.transform = `translate3d(0, ${el.offsetHeight + 40}px, 0)`
        cerrar.current()
      } else {
        el.style.transition = `transform 320ms ${CURVA_IOS}`
        el.style.transform = ''
      }
    }

    zona.addEventListener('pointerdown', bajar)
    zona.addEventListener('pointermove', mover)
    zona.addEventListener('pointerup', soltar)
    zona.addEventListener('pointercancel', soltar)
    return () => {
      zona.removeEventListener('pointerdown', bajar)
      zona.removeEventListener('pointermove', mover)
      zona.removeEventListener('pointerup', soltar)
      zona.removeEventListener('pointercancel', soltar)
    }
  }, [hoja, activa])

  return asa
}
