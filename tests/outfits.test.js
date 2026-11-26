import test from 'node:test'
import assert from 'node:assert/strict'
import { claveCombinacion, esDuplicado, limitarPosicion } from '../src/lib/outfits.js'

test('la misma combinación en otro orden y con otro tipo de id da la misma clave', () => {
  assert.equal(claveCombinacion([3, 1, 2]), claveCombinacion(['2', '3', '1']))
})

test('una combinación repetida se detecta como duplicada', () => {
  const conjuntos = [{ conjunto_prenda: [{ prenda_id: 1 }, { prenda_id: 2 }] }]
  assert.equal(esDuplicado(conjuntos, [2, 1]), true)
})

test('una combinación distinta no es duplicada', () => {
  const conjuntos = [{ conjunto_prenda: [{ prenda_id: 1 }, { prenda_id: 2 }] }]
  assert.equal(esDuplicado(conjuntos, [1, 2, 3]), false)
})

test('si la consulta falla no se bloquea el guardado', () => {
  assert.equal(esDuplicado(null, [1, 2]), false)
})

test('la posición se queda dentro del lienzo', () => {
  assert.deepEqual(limitarPosicion(-30, 500, 300, 400, 112), { x: 0, y: 288 })
  assert.deepEqual(limitarPosicion(50, 60, 300, 400, 112), { x: 50, y: 60 })
})
