import { useEffect, useRef } from 'react'
import { crearDetectorPulsacionLarga } from './pulsacionLarga.js'

/**
 * Pulsación larga en un elemento. Devuelve los manejadores de puntero y
 * `consumirClic`: mientras sea true, el clic que llegue después no debe abrir
 * nada (el dedo ya había abierto el menú o estaba desplazando).
 */
export function usePulsacionLarga(onLargo, { espera } = {}) {
  const detector = useRef(null)
  const aviso = useRef(onLargo)
  aviso.current = onLargo

  if (!detector.current) {
    detector.current = crearDetectorPulsacionLarga({ onLargo: () => aviso.current?.(), espera })
  }

  useEffect(() => () => detector.current?.cancelar(), [])

  return {
    iniciar: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      detector.current.iniciar(e)
    },
    mover: (e) => detector.current.mover(e),
    soltar: () => detector.current.soltar(),
    cancelar: () => detector.current.cancelar(),
    consumirClic: () => detector.current.consumirClic(),
  }
}
