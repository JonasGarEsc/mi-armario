import test from 'node:test'
import assert from 'node:assert/strict'
import { nombreLibre } from '../src/lib/nombres.js'

test('si el nombre está libre se queda tal cual', () => {
  assert.equal(nombreLibre('Día 1', ['Día 2']), 'Día 1')
})

test('el segundo clon se numera en vez de fallar', () => {
  assert.equal(nombreLibre('París (Copia)', ['París (Copia)']), 'París (Copia) (2)')
  assert.equal(nombreLibre('París (Copia)', ['París (Copia)', 'París (Copia) (2)']), 'París (Copia) (3)')
})

test('no distingue mayúsculas', () => {
  assert.equal(nombreLibre('día 1', ['DÍA 1']), 'día 1 (2)')
})
