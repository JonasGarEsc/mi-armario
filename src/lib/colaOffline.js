// Acciones sin conexión: lo que hagas sin red (anotar un uso, marcar la lista de la maleta)
// se guarda en el móvil y se envía, en orden, cuando vuelve la conexión.
// Aquí solo hay lógica pura (el almacén y el ejecutor se inyectan): se prueba sin red.

/** ¿El error es de red (sin conexión, servidor inalcanzable) y no un rechazo del servidor? */
export function esErrorDeRed(error) {
  if (!error) return false
  const texto = `${error.name || ''} ${error.message || ''}`
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet|offline/i.test(texto)
    || error.name === 'TypeError'
}

/** Ejecuta una operación contra Supabase. Devuelve { error }. */
export async function ejecutarOperacion(supabase, op) {
  const tabla = supabase.from(op.tabla)
  switch (op.accion) {
    case 'insert': return tabla.insert([op.datos])
    case 'upsert': return tabla.upsert([op.datos], op.onConflict ? { onConflict: op.onConflict } : undefined)
    case 'update': return tabla.update(op.datos).match(op.filtro)
    case 'delete': return tabla.delete().match(op.filtro)
    default: return { error: { message: `Operación desconocida: ${op.accion}` } }
  }
}

/**
 * Cola persistente de operaciones. `almacen`: { leer() → lista, guardar(lista) };
 * `ejecutar(op)` → { error }; `enLinea()` → boolean.
 * `enviar(op)` devuelve 'hecha' (ya en el servidor), 'encolada' (se enviará luego) o 'error'
 * (el servidor la rechazó: no tiene sentido reintentarla).
 */
export function crearColaOffline({ almacen, ejecutar, enLinea }) {
  let cola = almacen.leer()
  const oyentes = new Set()
  let vaciando = null
  let numero = 0

  const guardar = () => { almacen.guardar(cola); oyentes.forEach((f) => f()) }
  const encolar = (op) => { cola = [...cola, { ...op, idCola: `${Date.now()}-${++numero}` }]; guardar() }

  async function vaciar() {
    if (vaciando) return vaciando
    vaciando = (async () => {
      let enviadas = 0
      let descartadas = 0
      while (cola.length > 0 && enLinea()) {
        const op = cola[0]
        let resultado
        try { resultado = await ejecutar(op) } catch (e) { resultado = { error: e } }
        if (resultado.error && esErrorDeRed(resultado.error)) break // sigue sin red: se conserva todo
        // Enviada, o rechazada por el servidor (se descarta para que no bloquee a las demás).
        cola = cola.slice(1)
        guardar()
        if (resultado.error) descartadas++
        else enviadas++
      }
      return { enviadas, descartadas, quedan: cola.length }
    })().finally(() => { vaciando = null })
    return vaciando
  }

  return {
    /** Vuelve a leer lo guardado (al cambiar de cuenta, la cola es otra). */
    recargar() { cola = almacen.leer(); oyentes.forEach((f) => f()) },
    pendientes: () => cola,
    cuantas: () => cola.length,
    suscribir(f) { oyentes.add(f); return () => oyentes.delete(f) },
    vaciar,

    async enviar(op) {
      // Con cola pendiente, la nueva va detrás para respetar el orden.
      if (!enLinea() || cola.length > 0) {
        encolar(op)
        if (enLinea()) vaciar()
        return 'encolada'
      }
      let resultado
      try { resultado = await ejecutar(op) } catch (e) { resultado = { error: e } }
      if (!resultado.error) return 'hecha'
      if (esErrorDeRed(resultado.error)) { encolar(op); return 'encolada' }
      return 'error'
    },
  }
}
