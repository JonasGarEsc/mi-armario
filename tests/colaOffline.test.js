import test from 'node:test'
import assert from 'node:assert/strict'
import { crearColaOffline, ejecutarOperacion, esErrorDeRed, esErrorTemporal } from '../src/lib/colaOffline.js'

const almacenEnMemoria = (inicial = []) => {
  const a = { datos: inicial, leer: () => a.datos, guardar: (l) => { a.datos = l } }
  return a
}
const red = { message: 'TypeError: Failed to fetch' }
const duplicado = { message: 'duplicate key value', code: '23505' }
const rechazo = { message: 'violates foreign key constraint', code: '23503' }
const op = (n) => ({ tabla: 'usos', accion: 'insert', datos: { n } })

function entorno({ linea = true, respuestas = [] } = {}) {
  const estado = { linea, enviadas: [], respuestas: [...respuestas] }
  const almacen = almacenEnMemoria()
  const cola = crearColaOffline({
    almacen,
    enLinea: () => estado.linea,
    ejecutar: async (o) => {
      const r = estado.respuestas.length ? estado.respuestas.shift() : null
      if (!r?.error) estado.enviadas.push(o.datos.n)
      return r || { error: null }
    },
  })
  return { estado, almacen, cola }
}

test('reconoce los errores de red y no confunde un rechazo del servidor', () => {
  assert.equal(esErrorDeRed(red), true)
  assert.equal(esErrorDeRed({ message: 'Load failed' }), true)
  assert.equal(esErrorDeRed(rechazo), false)
  assert.equal(esErrorDeRed(null), false)
})

test('sesión caducada, 5xx, 429 y red son temporales; un rechazo de datos no', () => {
  assert.equal(esErrorTemporal({ message: 'JWT expired', status: 401 }), true)
  assert.equal(esErrorTemporal({ code: 'PGRST301', message: 'JWT expired' }), true)
  assert.equal(esErrorTemporal({ message: 'Internal Server Error', status: 500 }), true)
  assert.equal(esErrorTemporal({ message: 'Service Unavailable', status: 503 }), true)
  assert.equal(esErrorTemporal({ message: 'Too Many Requests', status: 429 }), true)
  assert.equal(esErrorTemporal(red), true)
  assert.equal(esErrorTemporal(rechazo), false)
  assert.equal(esErrorTemporal({ message: 'invalid input syntax', status: 400 }), false)
  assert.equal(esErrorTemporal(null), false)
})

test('con conexión, la acción se hace al momento', async () => {
  const { cola, estado } = entorno()
  assert.equal(await cola.enviar(op(1)), 'hecha')
  assert.deepEqual(estado.enviadas, [1])
  assert.equal(cola.cuantas(), 0)
})

test('sin conexión se encola y se guarda en el móvil', async () => {
  const { cola, estado, almacen } = entorno({ linea: false })
  assert.equal(await cola.enviar(op(1)), 'encolada')
  assert.equal(await cola.enviar(op(2)), 'encolada')
  assert.equal(cola.cuantas(), 2)
  assert.equal(almacen.datos.length, 2)
  assert.deepEqual(estado.enviadas, [])
})

test('al volver la conexión se envía todo, en orden', async () => {
  const { cola, estado } = entorno({ linea: false })
  await cola.enviar(op(1)); await cola.enviar(op(2)); await cola.enviar(op(3))
  estado.linea = true
  assert.deepEqual(await cola.vaciar(), { enviadas: 3, descartadas: 0, quedan: 0 })
  assert.deepEqual(estado.enviadas, [1, 2, 3])
})

test('si la red falla a mitad, lo que queda se conserva', async () => {
  const { cola, estado } = entorno({ linea: false, respuestas: [null, { error: red }] })
  await cola.enviar(op(1)); await cola.enviar(op(2)); await cola.enviar(op(3))
  estado.linea = true
  assert.deepEqual(await cola.vaciar(), { enviadas: 1, descartadas: 0, quedan: 2 })
  assert.deepEqual(cola.pendientes().map((p) => p.datos.n), [2, 3])
})

test('una sesión caducada o un 5xx conserva la cola y se reintenta después', async () => {
  const { cola, estado } = entorno({
    linea: false,
    respuestas: [{ error: { message: 'JWT expired', status: 401 } }, null, null],
  })
  await cola.enviar(op(1)); await cola.enviar(op(2))
  estado.linea = true
  assert.deepEqual(await cola.vaciar(), { enviadas: 0, descartadas: 0, quedan: 2 })
  assert.deepEqual(cola.pendientes().map((p) => p.datos.n), [1, 2])
  // Al reintentar (red, reapertura o sesión refrescada) entran las dos.
  assert.deepEqual(await cola.vaciar(), { enviadas: 2, descartadas: 0, quedan: 0 })
  assert.deepEqual(estado.enviadas, [1, 2])
})

test('un 429 también se conserva para más tarde', async () => {
  const { cola, estado } = entorno({ linea: false, respuestas: [{ error: { message: 'Too Many Requests', status: 429 } }] })
  await cola.enviar(op(1))
  estado.linea = true
  assert.deepEqual(await cola.vaciar(), { enviadas: 0, descartadas: 0, quedan: 1 })
  assert.equal(cola.cuantas(), 1)
})

test('un 401 al enviar sin cola se encola en vez de perderse', async () => {
  const { cola, estado } = entorno({ respuestas: [{ error: { message: 'JWT expired', status: 401 } }] })
  assert.equal(await cola.enviar(op(1)), 'encolada')
  assert.equal(cola.cuantas(), 1)
  assert.deepEqual(estado.enviadas, [])
})

test('al descartar un rechazo definitivo se avisa con el número', async () => {
  const { cola, estado } = entorno({ linea: false, respuestas: [{ error: rechazo }] })
  const avisos = []
  cola.suscribirDescartes((n) => avisos.push(n))
  await cola.enviar(op(1))
  estado.linea = true
  assert.deepEqual(await cola.vaciar(), { enviadas: 0, descartadas: 1, quedan: 0 })
  assert.deepEqual(avisos, [1])
})

test('un uso repetido (23505) cuenta como hecho y no se descarta', async () => {
  const { cola, estado } = entorno({ linea: false, respuestas: [{ error: duplicado }] })
  await cola.enviar(op(1))
  estado.linea = true
  assert.deepEqual(await cola.vaciar(), { enviadas: 1, descartadas: 0, quedan: 0 })
  assert.equal(cola.cuantas(), 0)
  assert.deepEqual(estado.enviadas, [])
})

test('un rechazo del servidor se descarta y no bloquea las demás', async () => {
  const { cola, estado } = entorno({ linea: false, respuestas: [{ error: rechazo }, null] })
  await cola.enviar(op(1)); await cola.enviar(op(2))
  estado.linea = true
  assert.deepEqual(await cola.vaciar(), { enviadas: 1, descartadas: 1, quedan: 0 })
  assert.deepEqual(estado.enviadas, [2])
})

test('con la cola pendiente, una acción nueva espera su turno', async () => {
  const { cola, estado } = entorno({ linea: false })
  await cola.enviar(op(1))
  estado.linea = true
  assert.equal(await cola.enviar(op(2)), 'encolada')
  await cola.vaciar()
  assert.deepEqual(estado.enviadas, [1, 2])
})

test('si falla la red al enviar, se encola; si el servidor rechaza, es un error', async () => {
  const a = entorno({ respuestas: [{ error: red }] })
  assert.equal(await a.cola.enviar(op(1)), 'encolada')
  assert.equal(a.cola.cuantas(), 1)
  const b = entorno({ respuestas: [{ error: rechazo }] })
  assert.equal(await b.cola.enviar(op(1)), 'error')
  assert.equal(b.cola.cuantas(), 0)
})

test('lo pendiente sobrevive a cerrar la app', async () => {
  const { cola, almacen } = entorno({ linea: false })
  await cola.enviar(op(7))
  const reabierta = crearColaOffline({ almacen, enLinea: () => true, ejecutar: async () => ({ error: null }) })
  assert.equal(reabierta.cuantas(), 1)
  assert.deepEqual(await reabierta.vaciar(), { enviadas: 1, descartadas: 0, quedan: 0 })
})

test('vaciar a la vez no duplica envíos', async () => {
  const { cola, estado } = entorno({ linea: false })
  await cola.enviar(op(1)); await cola.enviar(op(2))
  estado.linea = true
  await Promise.all([cola.vaciar(), cola.vaciar()])
  assert.deepEqual(estado.enviadas, [1, 2])
})

test('traduce cada operación a la llamada de Supabase', async () => {
  const llamadas = []
  const tabla = {
    insert: (x) => { llamadas.push(['insert', x]); return Promise.resolve({ error: null }) },
    upsert: (x, o) => { llamadas.push(['upsert', x, o]); return Promise.resolve({ error: null }) },
    update: (x) => ({ match: (f) => { llamadas.push(['update', x, f]); return Promise.resolve({ error: null }) } }),
    delete: () => ({ match: (f) => { llamadas.push(['delete', f]); return Promise.resolve({ error: null }) } }),
  }
  const supabase = { from: (t) => { llamadas.push(['from', t]); return tabla } }
  await ejecutarOperacion(supabase, { tabla: 'usos', accion: 'insert', datos: { a: 1 } })
  await ejecutarOperacion(supabase, { tabla: 'maleta_extras', accion: 'upsert', datos: { a: 1 }, onConflict: 'maleta_id,prenda_id' })
  await ejecutarOperacion(supabase, { tabla: 'maleta_extras', accion: 'update', datos: { hecho: true }, filtro: { id: 'x' } })
  await ejecutarOperacion(supabase, { tabla: 'maleta_extras', accion: 'delete', filtro: { id: 'x' } })
  assert.deepEqual(llamadas.filter((l) => l[0] !== 'from'), [
    ['insert', [{ a: 1 }]], ['upsert', [{ a: 1 }], { onConflict: 'maleta_id,prenda_id' }],
    ['update', { hecho: true }, { id: 'x' }], ['delete', { id: 'x' }],
  ])
  assert.equal((await ejecutarOperacion(supabase, { tabla: 'x', accion: 'raro' })).error.message, 'Operación desconocida: raro')
})

test('al cambiar de cuenta, la cola recargada es la de esa cuenta', async () => {
  const { cola, almacen } = entorno({ linea: false })
  await cola.enviar(op(1))
  assert.equal(cola.cuantas(), 1)
  almacen.datos = [] // otra cuenta: su almacén está vacío
  cola.recargar()
  assert.equal(cola.cuantas(), 0)
})

import { elegirUrl } from '../src/lib/urlFoto.js'

test('sin firma nueva se usa la última guardada, aunque haya caducado, antes que la URL base', () => {
  assert.equal(elegirUrl('nueva', 'vieja', 'base'), 'nueva')
  assert.equal(elegirUrl(null, 'vieja', 'base'), 'vieja')
  assert.equal(elegirUrl(null, undefined, 'base'), 'base')
  assert.equal(elegirUrl(null, null, null), null)
})

test('un 503 o un 429 se reconocen por el estado de la respuesta', () => {
  assert.equal(esErrorTemporal({ message: 'x' }, 503), true)
  assert.equal(esErrorTemporal({ message: 'x' }, 429), true)
  assert.equal(esErrorTemporal({ message: 'violates check constraint', code: '23514' }, 400), false)
})
