// Detector de pulsación larga, sin React: se le pasan los puntos del dedo y
// avisa cuando se queda quieto el tiempo suficiente. Si el dedo se mueve (o el
// navegador cancela el gesto porque está desplazando) no hay pulsación larga, y
// el clic posterior se descarta para que no se abran dos cosas.

export const ESPERA_PULSACION = 500
export const TOLERANCIA_PULSACION = 10

export function crearDetectorPulsacionLarga({
  onLargo,
  espera = ESPERA_PULSACION,
  tolerancia = TOLERANCIA_PULSACION,
  programar = setTimeout,
  cancelar = clearTimeout,
} = {}) {
  let temporizador = null
  let inicio = null
  let larga = false
  let movido = false
  let activo = false

  const pararReloj = () => {
    if (temporizador !== null) {
      cancelar(temporizador)
      temporizador = null
    }
  }

  function iniciar(punto = {}) {
    pararReloj()
    activo = true
    larga = false
    movido = false
    inicio = { x: Number(punto.x) || 0, y: Number(punto.y) || 0 }
    temporizador = programar(() => {
      temporizador = null
      if (!activo || movido) return
      larga = true
      onLargo?.()
    }, espera)
  }

  function mover(punto = {}) {
    if (!activo || movido || !inicio) return
    const dx = (Number(punto.x) || 0) - inicio.x
    const dy = (Number(punto.y) || 0) - inicio.y
    if (Math.hypot(dx, dy) > tolerancia) {
      movido = true
      pararReloj()
    }
  }

  function soltar() {
    activo = false
    pararReloj()
  }

  /** El navegador tomó el gesto (scroll, otro dedo…): no cuenta y el clic no abre nada. */
  function cancelarGesto() {
    if (activo) movido = true
    activo = false
    pararReloj()
  }

  /** ¿El clic que llega ahora es consecuencia de una pulsación larga o un arrastre? */
  function consumirClic() {
    const bloquear = larga || movido
    larga = false
    movido = false
    return bloquear
  }

  return { iniciar, mover, soltar, cancelar: cancelarGesto, consumirClic }
}
