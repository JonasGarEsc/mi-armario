import test from 'node:test'
import assert from 'node:assert/strict'
import { leerChecklist, limpiarTexto, pendientes, yaEsta } from '../src/lib/checklistMaleta.js'

test('el texto de la lista se limpia y se acota', () => {
  assert.equal(limpiarTexto('  Cargador   del móvil '), 'Cargador del móvil')
  assert.equal(limpiarTexto(null), '')
  assert.equal(limpiarTexto('x'.repeat(200)).length, 80)
})

test('no se repite una cosa aunque cambien mayúsculas o acentos', () => {
  const extras = [{ id: '1', texto: 'Adaptador de enchufe' }, { id: '2', texto: 'Botiquín' }]
  assert.equal(yaEsta(extras, 'adaptador DE enchufe'), true)
  assert.equal(yaEsta(extras, 'botiquin'), true)
  assert.equal(yaEsta(extras, 'Paraguas'), false)
})

test('cuenta lo que falta por meter', () => {
  const r = pendientes(
    [{ id: 'a', hecho: true }, { id: 'b', hecho: false }],
    ['p1'],
    [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
  )
  assert.deepEqual(r, { extras: 1, prendas: 2 })
})

function dbFalsa({ filas = [], error = null, errorInsert = null, errorUpsert = null } = {}) {
  const insertadas = []
  const upserts = []
  return {
    insertadas,
    upserts,
    cliente: {
      from: () => ({
        select: () => ({ eq: () => ({ order: async () => ({ data: filas, error }) }) }),
        insert: async (nuevas) => { insertadas.push(...nuevas); return { error: errorInsert } },
        upsert: async (nuevas) => { upserts.push(...nuevas); return { error: errorUpsert } },
      }),
    },
  }
}

function conAlmacenLocal(prueba) {
  const datos = new Map()
  const anterior = globalThis.localStorage
  globalThis.localStorage = {
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => datos.set(clave, String(valor)),
    removeItem: (clave) => datos.delete(clave),
  }
  return Promise.resolve().then(() => prueba(datos)).finally(() => {
    if (anterior === undefined) delete globalThis.localStorage
    else globalThis.localStorage = anterior
  })
}

const cache = (datos, clave, valor) => datos.set(`armario_v2_anon:${clave}`, JSON.stringify(valor))

test('migra a la base las casillas y las cosas que solo estaban en el móvil', () => conAlmacenLocal(async (datos) => {
  cache(datos, 'checklist_m1', ['p1'])
  cache(datos, 'extras_m1', [{ id: 'local-1', texto: 'Paraguas', hecho: true }])
  const db = dbFalsa()

  const r = await leerChecklist(db.cliente, 'm1')

  assert.deepEqual(r.marcadas, ['p1'])
  assert.equal(r.extras.some((e) => e.texto === 'Paraguas' && e.hecho), true)
  assert.deepEqual(db.upserts, [{ maleta_id: 'm1', prenda_id: 'p1', hecho: true }])
  assert.equal(db.insertadas[0].texto, 'Paraguas')
  assert.equal(JSON.parse(datos.get('armario_v2_anon:checklist_m1')), null)
  assert.equal(JSON.parse(datos.get('armario_v2_anon:extras_m1')), null)
}))

test('si falla la migración, las casillas del móvil no se pierden', () => conAlmacenLocal(async (datos) => {
  cache(datos, 'checklist_m1', ['p1'])
  const db = dbFalsa({ errorUpsert: { message: 'sin permisos' } })

  const r = await leerChecklist(db.cliente, 'm1')

  assert.deepEqual(r.marcadas, [])
  assert.deepEqual(JSON.parse(datos.get('armario_v2_anon:checklist_m1')), ['p1'])
}))

test('sin conexión enseña la copia guardada', () => conAlmacenLocal(async (datos) => {
  cache(datos, 'checklistdb_m1', { extras: [{ id: 'e1', texto: 'Neceser', hecho: false }], marcadas: ['p2'] })
  const db = dbFalsa({ filas: null, error: { message: 'Failed to fetch' } })

  const r = await leerChecklist(db.cliente, 'm1')

  assert.equal(r.sinConexion, true)
  assert.equal(r.error, null)
  assert.equal(r.extras[0].texto, 'Neceser')
  assert.deepEqual(r.marcadas, ['p2'])
}))

test('un fallo real de la lista se informa sin guardar solo en el móvil', () => conAlmacenLocal(async (datos) => {
  cache(datos, 'checklistdb_m1', { extras: [{ id: 'e1', texto: 'Neceser', hecho: false }], marcadas: ['p2'] })
  const db = dbFalsa({ filas: null, error: { message: 'permiso denegado' } })

  const r = await leerChecklist(db.cliente, 'm1')

  assert.equal(r.sinConexion, false)
  assert.equal(r.error, 'No se pudo leer la lista de la maleta')
  assert.equal(r.extras[0].texto, 'Neceser')
  assert.deepEqual(r.marcadas, ['p2'])
}))
