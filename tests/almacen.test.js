import test from 'node:test'
import assert from 'node:assert/strict'
import { CONSULTA_PRENDAS, CONSULTA_SIN_USOS, consultarPrendas, crearAlmacenPrendas } from '../src/lib/almacen.js'

const ids = (a) => a.obtener().prendas.map((p) => p.id)

test('pinta la caché al instante y refresca por detrás', async () => {
  const guardados = []
  const almacen = crearAlmacenPrendas({
    leer: () => [{ id: 'cache' }],
    guardar: (l) => guardados.push(l),
    consultar: async () => [{ id: 'servidor' }],
    resumen: (p) => p,
  })

  assert.deepEqual(ids(almacen), ['cache'])
  assert.equal(almacen.obtener().cargando, false)

  await almacen.cargar()
  assert.deepEqual(ids(almacen), ['servidor'])
  assert.equal(almacen.obtener().cargada, true)
  assert.deepEqual(guardados.at(-1), [{ id: 'servidor' }])
})

test('cargar a la vez solo lanza una consulta', async () => {
  let llamadas = 0
  const almacen = crearAlmacenPrendas({
    consultar: async () => { llamadas++; return [] },
  })
  await Promise.all([almacen.cargar(), almacen.cargar(), almacen.refrescar().then(() => {})])
  assert.equal(llamadas, 2) // una normal y otra forzada
})

test('una respuesta antigua que llega tarde no pisa la más nueva', async () => {
  const pendientes = []
  const almacen = crearAlmacenPrendas({
    consultar: () => new Promise((resolver) => pendientes.push(resolver)),
    resumen: (p) => p,
  })

  const vieja = almacen.cargar()
  const nueva = almacen.refrescar()
  assert.equal(pendientes.length, 2)

  pendientes[1]([{ id: 'nueva' }])
  await nueva
  pendientes[0]([{ id: 'vieja' }])
  await vieja

  assert.deepEqual(ids(almacen), ['nueva'])
})

test('un cambio local invalida la consulta que ya estaba en marcha', async () => {
  const pendientes = []
  const almacen = crearAlmacenPrendas({
    leer: () => [{ id: 'vieja' }],
    consultar: () => new Promise((resolver) => pendientes.push(resolver)),
    resumen: (p) => p,
  })

  const enVuelo = almacen.cargar()
  almacen.quitar('vieja')
  pendientes[0]([{ id: 'vieja' }])
  await enVuelo

  assert.deepEqual(ids(almacen), [])
})

test('al reiniciar se vacía y se lee la caché de la cuenta nueva', () => {
  let cache = [{ id: 'cuenta-a' }]
  const almacen = crearAlmacenPrendas({
    leer: () => cache,
    resumen: (p) => p,
  })

  assert.deepEqual(ids(almacen), ['cuenta-a'])
  cache = [{ id: 'cuenta-b' }]
  almacen.reiniciar()
  assert.deepEqual(ids(almacen), ['cuenta-b'])

  cache = null
  almacen.reiniciar()
  assert.deepEqual(ids(almacen), [])
  assert.equal(almacen.obtener().cargando, true)
})

test('actualizar, quitar y reponer se reflejan al momento y en la caché', () => {
  const guardados = []
  const almacen = crearAlmacenPrendas({
    leer: () => [{ id: '1', nombre: 'Uno', archivada: false }],
    guardar: (l) => guardados.push(l),
    resumen: (p) => ({ id: p.id, archivada: p.archivada }),
  })

  const antes = almacen.actualizar('1', { archivada: true })
  assert.equal(antes.archivada, false)
  assert.equal(almacen.obtener().prendas[0].archivada, true)
  assert.deepEqual(guardados.at(-1), [{ id: '1', archivada: true }])

  const quitada = almacen.quitar('1')
  assert.equal(quitada.id, '1')
  assert.deepEqual(ids(almacen), [])
  almacen.reponer(quitada)
  assert.deepEqual(ids(almacen), ['1'])
})

test('si la base no tiene usos, se reintenta sin ellos', async () => {
  const consultas = []
  const supabase = {
    from: () => ({
      select: (columnas) => ({
        order: async () => {
          consultas.push(columnas)
          return columnas === CONSULTA_PRENDAS
            ? { data: null, error: { message: 'relation usos does not exist' } }
            : { data: [{ id: 'sin-usos' }], error: null }
        },
      }),
    }),
  }

  assert.deepEqual(await consultarPrendas(supabase), [{ id: 'sin-usos' }])
  assert.deepEqual(consultas, [CONSULTA_PRENDAS, CONSULTA_SIN_USOS])
  assert.equal(await consultarPrendas(null), null)
})

test('si fallan las dos consultas se conserva lo que ya había', async () => {
  const almacen = crearAlmacenPrendas({
    leer: () => [{ id: 'cache' }],
    consultar: async () => null,
    resumen: (p) => p,
  })

  await almacen.cargar()
  assert.deepEqual(ids(almacen), ['cache'])
  assert.equal(almacen.obtener().cargando, false)
  assert.equal(almacen.obtener().error, 'No se pudieron cargar las prendas')
})

test('revalidar vuelve a consultar y conserva la lista si nada cambió', async () => {
  let veces = 0
  let datos = [{ id: 1 }]
  const almacen = crearAlmacenPrendas({ consultar: async () => { veces++; return structuredClone(datos) } })
  await almacen.revalidar()
  const primera = almacen.obtener().prendas
  await almacen.revalidar()
  assert.equal(veces, 2)
  assert.equal(almacen.obtener().prendas, primera)
  datos = [{ id: 2 }]
  await almacen.revalidar()
  assert.equal(almacen.obtener().prendas[0].id, 2)
})
