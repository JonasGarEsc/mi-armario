import test from 'node:test'
import assert from 'node:assert/strict'
import { aFraccion, claveCombinacion, esDuplicado, esPosicionEnPixeles, limitarPosicion } from '../src/lib/outfits.js'

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

test('las posiciones nuevas van en fracción del lienzo y las antiguas se reconocen', () => {
  assert.equal(esPosicionEnPixeles(40, 20), true) // valor por defecto de la base
  assert.equal(esPosicionEnPixeles(0.1, 0.6), false)
  assert.deepEqual(aFraccion(30, 150, 300, 300, 84), { x: 0.1, y: 0.5 })
  // Se queda dentro del lienzo aunque se arrastre fuera.
  assert.deepEqual(aFraccion(-20, 999, 300, 300, 84), { x: 0, y: 216 / 300 })
  assert.deepEqual(aFraccion(10, 10, 0, 0, 0), { x: 0, y: 0 })
})
