// Acciones sin conexión: lo que hagas sin red (anotar un uso, marcar la lista de la maleta)
// se guarda en el móvil y se envía, en orden, cuando vuelve la conexión.
// Aquí solo hay lógica pura (el almacén y el ejecutor se inyectan): se prueba sin red.

import { esUsoDuplicado } from './uso.js'

/** ¿El error es de red (sin conexión, servidor inalcanzable) y no un rechazo del servidor? */
export function esErrorDeRed(error) {
  if (!error) return false
  const texto = `${error.name || ''} ${error.message || ''}`
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet|offline/i.test(texto)
    || error.name === 'TypeError'
}

/**
 * ¿Merece la pena reintentarlo? Sesión caducada (401), límite de peticiones (429),
 * fallos del servidor (5xx), tiempos agotados y red: se conserva en la cola.
 * El resto (datos inválidos, permisos, claves ajenas...) nunca entrará.
 */
export function esErrorTemporal(error, status) {
  if (!error) return false
  if (esErrorDeRed(error)) return true
  const estado = Number(status ?? error.status ?? error.statusCode)
  if (estado === 401 || estado === 408 || estado === 429 || estado >= 500) return true
  const texto = `${error.code || ''} ${error.message || ''}`
  return /PGRST301|jwt|token.*(?:expir|caduc)|(?:expir|caduc).*token|unauthorized|sesi[oó]n|rate limit|too many requests|internal server error|service unavailable|bad gateway|gateway timeout|database error|server error|timeout|temporar|\b(?:401|408|429|5\d\d)\b/i.test(texto)
}

/** Un uso repetido (23505) ya está en el servidor: la operación vale por hecha. */
const esExito = (op, error) => !error || (op?.tabla === 'usos' && esUsoDuplicado(error))

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
  const oyentesDescarte = new Set()
  let vaciando = null
  let numero = 0

  const guardar = () => { almacen.guardar(cola); oyentes.forEach((f) => f()) }
  const encolar = (op) => { cola = [...cola, { ...op, idCola: `${Date.now()}-${++numero}` }]; guardar() }
  const avisarDescarte = (n) => oyentesDescarte.forEach((f) => f(n))

  async function vaciar() {
    if (vaciando) return vaciando
    vaciando = (async () => {
      let enviadas = 0
      let descartadas = 0
      while (cola.length > 0 && enLinea()) {
        const op = cola[0]
        let resultado
        try { resultado = await ejecutar(op) } catch (e) { resultado = { error: e } }
        // Sin red, sesión caducada, 5xx, 429...: se conserva todo y se reintenta luego.
        if (resultado.error && esErrorTemporal(resultado.error, resultado.status)) break
        // Hecha, o rechazada para siempre (se descarta para que no bloquee a las demás).
        cola = cola.slice(1)
        guardar()
        if (esExito(op, resultado.error)) enviadas++
        else descartadas++
      }
      if (descartadas > 0) avisarDescarte(descartadas)
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
    /** Avisa de cada cambio descartado (para decírselo al usuario, con el número). */
    suscribirDescartes(f) { oyentesDescarte.add(f); return () => oyentesDescarte.delete(f) },
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
      if (esExito(op, resultado.error)) return 'hecha'
      if (esErrorTemporal(resultado.error, resultado.status)) { encolar(op); return 'encolada' }
      return 'error'
    },
  }
}
