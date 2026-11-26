import { useSyncExternalStore } from 'react'

// Sección que se ve en pantalla. Cambia en cuanto sueltas el dedo, antes de
// que la app cambie de sección del todo: así la barra de pestañas y el
// título reaccionan al instante sin volver a pintar las tres pantallas a
// mitad de la animación (eso es lo que daba el microcorte).
let valor = null
const oyentes = new Set()

export function fijarSeccionVisual(nueva) {
  if (nueva === valor) return
  valor = nueva
  oyentes.forEach((avisar) => avisar())
}

const suscribir = (avisar) => {
  oyentes.add(avisar)
  return () => oyentes.delete(avisar)
}

export function useSeccionVisual(respaldo) {
  return useSyncExternalStore(suscribir, () => valor) ?? respaldo
}
