import test from 'node:test'
import assert from 'node:assert/strict'
import { insertarConjuntos } from '../src/lib/insertarConjuntos.js'

function supabaseEspia({ errorConjuntos = null, errorPrendas = null } = {}) {
  const llamadas = []
  const supabase = {
    from: (tabla) => ({
      insert: async (filas, opciones) => {
        llamadas.push({ accion: 'insert', tabla, filas, opciones })
        if (tabla === 'conjuntos') return { error: errorConjuntos }
        if (tabla === 'conjunto_prenda') return { error: errorPrendas }
        return { error: null }
      },
      delete: () => ({
        in: async (columna, valores) => {
          llamadas.push({ accion: 'delete', tabla, columna, valores })
          return { error: null }
        },
      }),
    }),
  }
  return { supabase, llamadas }
}

test('inserta primero en conjuntos sin conjunto_prenda y luego en conjunto_prenda con conjunto_id', async () => {
  const { supabase, llamadas } = supabaseEspia()
  const error = await insertarConjuntos(supabase, [{
    nombre: 'Look',
    maleta_id: 'm1',
    conjunto_prenda: [
      { prenda_id: 'p1' },
      { prenda_id: 'p2', escala: 1.2, por_dentro: true },
    ],
  }])

  assert.equal(error, null)
  assert.deepEqual(llamadas.map((l) => `${l.accion}:${l.tabla}`), [
    'insert:conjuntos',
    'insert:conjunto_prenda',
  ])

  const [conjunto] = llamadas[0].filas
  assert.match(conjunto.id, /^[0-9a-f-]{36}$/i)
  assert.equal(conjunto.nombre, 'Look')
  assert.equal(conjunto.maleta_id, 'm1')
  assert.equal('conjunto_prenda' in conjunto, false)
  assert.equal('user_id' in conjunto, false)

  assert.deepEqual(llamadas[1].opciones, { defaultToNull: false })
  assert.deepEqual(llamadas[1].filas, [
    { prenda_id: 'p1', conjunto_id: conjunto.id },
    { prenda_id: 'p2', escala: 1.2, por_dentro: true, conjunto_id: conjunto.id },
  ])
})

test('conserva el id del conjunto si ya viene informado', async () => {
  const { supabase, llamadas } = supabaseEspia()
  const error = await insertarConjuntos(supabase, [{
    id: 'id-copia',
    nombre: 'Restaurado',
    maleta_id: 'm1',
    conjunto_prenda: [{ prenda_id: 'p1', pos_x: 10, pos_y: 20, z_index: 2 }],
  }])

  assert.equal(error, null)
  assert.equal(llamadas[0].filas[0].id, 'id-copia')
  assert.equal(llamadas[1].filas[0].conjunto_id, 'id-copia')
})

test('inserta varios conjuntos de una vez enlazando cada prenda a su outfit', async () => {
  const { supabase, llamadas } = supabaseEspia()
  const error = await insertarConjuntos(supabase, [
    { nombre: 'Día 1', maleta_id: 'm1', conjunto_prenda: [{ prenda_id: 'p1' }, { prenda_id: 'p2' }] },
    { nombre: 'Día 2', maleta_id: 'm1', conjunto_prenda: [{ prenda_id: 'p3' }] },
  ])

  assert.equal(error, null)
  assert.equal(llamadas.length, 2)
  const [c1, c2] = llamadas[0].filas
  assert.notEqual(c1.id, c2.id)
  assert.deepEqual(llamadas[1].filas, [
    { prenda_id: 'p1', conjunto_id: c1.id },
    { prenda_id: 'p2', conjunto_id: c1.id },
    { prenda_id: 'p3', conjunto_id: c2.id },
  ])
})

test('si falla insertar las prendas, borra los conjuntos recién creados y devuelve el error', async () => {
  const fallo = { code: '23503', message: 'prenda inexistente' }
  const { supabase, llamadas } = supabaseEspia({ errorPrendas: fallo })

  const error = await insertarConjuntos(supabase, [
    { nombre: 'A', maleta_id: 'm1', conjunto_prenda: [{ prenda_id: 'p1' }] },
    { nombre: 'B', maleta_id: 'm1', conjunto_prenda: [{ prenda_id: 'p2' }] },
  ])

  assert.equal(error, fallo)
  assert.deepEqual(llamadas.map((l) => `${l.accion}:${l.tabla}`), [
    'insert:conjuntos',
    'insert:conjunto_prenda',
    'delete:conjuntos',
  ])
  const idsCreados = llamadas[0].filas.map((c) => c.id)
  assert.equal(llamadas[2].columna, 'id')
  assert.deepEqual(llamadas[2].valores, idsCreados)
})

test('si falla insertar los conjuntos, no toca conjunto_prenda ni borra nada', async () => {
  const fallo = { code: '23505', message: 'duplicado' }
  const { supabase, llamadas } = supabaseEspia({ errorConjuntos: fallo })

  const error = await insertarConjuntos(supabase, [
    { nombre: 'A', maleta_id: 'm1', conjunto_prenda: [{ prenda_id: 'p1' }] },
  ])

  assert.equal(error, fallo)
  assert.equal(llamadas.length, 1)
})

test('una lista vacía no hace llamadas', async () => {
  const { supabase, llamadas } = supabaseEspia()
  assert.equal(await insertarConjuntos(supabase, []), null)
  assert.equal(llamadas.length, 0)
})
