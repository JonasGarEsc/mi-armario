// Botón Atrás del móvil: cada capa abierta (hoja o diálogo) deja una entrada
// en el historial, y Atrás la cierra en vez de salir de la app. La lógica va
// aparte para poder probarla con un history falso.

const CLAVE = '__perlettaAtras'
let siguiente = 0

/**
 * Crea el gestor de capas sobre `history`. Cada `abrir(id, cerrar)` devuelve
 * la función que hay que llamar al cerrar la capa; en el mismo turno se puede
 * volver a abrir (StrictMode o cambio de hoja) sin gastar otra entrada.
 */
export function crearGestorAtras(history, { programar = (fn) => setTimeout(fn, 100), eventos = globalThis.window ?? history } = {}) {
  const capas = []        // { id, cerrar, entrada }
  const pendientes = new Map() // id -> { token, capa, indice }
  const consumiendo = []  // entradas que estamos retirando nosotros
  let escuchando = false

  const alVolver = () => {
    // El popstate que provoca nuestro propio history.back() no debe cerrar nada.
    if (consumiendo.length > 0) {
      consumiendo.shift()
      return
    }
    capas.pop()?.cerrar()
  }

  function cerrarCapa(id) {
    const indice = capas.findIndex(c => c.id === id)
    if (indice === -1) return
    const [capa] = capas.splice(indice, 1)
    const token = {}
    pendientes.set(id, { token, capa, indice })
    // Esperamos un turno: si React vuelve a montar la misma capa (StrictMode)
    // la recuperamos sin tocar el historial.
    programar(() => {
      const pendiente = pendientes.get(id)
      if (!pendiente || pendiente.token !== token) return
      pendientes.delete(id)
      // Solo se retira si su entrada sigue siendo la actual.
      const estado = history.state
      if (!estado || estado[CLAVE] !== capa.entrada) return
      consumiendo.push(capa.entrada)
      history.back()
    })
  }

  function abrir(id, cerrar) {
    const pendiente = pendientes.get(id)
    if (pendiente) {
      pendientes.delete(id)
      const indice = Math.min(pendiente.indice, capas.length)
      capas.splice(indice, 0, { ...pendiente.capa, cerrar })
      return () => cerrarCapa(id)
    }

    const existente = capas.find(c => c.id === id)
    if (existente) {
      existente.cerrar = cerrar
      return () => cerrarCapa(id)
    }

    if (!escuchando) {
      escuchando = true
      eventos.addEventListener('popstate', alVolver) // popstate se emite en window, no en history
    }

    const entrada = ++siguiente
    capas.push({ id, cerrar, entrada })
    const previo = history.state
    // Sin tercer argumento: la URL no cambia, así el hash del enlace de
    // recuperación de Supabase se queda intacto.
    history.pushState({
      ...(previo && typeof previo === 'object' ? previo : {}),
      [CLAVE]: entrada,
    }, '')
    return () => cerrarCapa(id)
  }

  return { abrir }
}
