// Esperas con tope: una tarea lenta no puede bloquear una acción del usuario.

/** Espera a `promesa` como mucho `ms`; devuelve su valor o null (nunca lanza). */
export function conTiempoLimite(promesa, ms) {
  return new Promise((resolver) => {
    let hecho = false
    const terminar = (valor) => {
      if (hecho) return
      hecho = true
      clearTimeout(temporizador)
      resolver(valor)
    }
    const temporizador = setTimeout(() => terminar(null), ms)
    Promise.resolve(promesa).then(terminar, () => terminar(null))
  })
}
