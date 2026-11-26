import test from 'node:test'
import assert from 'node:assert/strict'
import { columnasDeResumen } from '../src/lib/resumenMaleta.js'

test('la cuadrícula del resumen crece con el número de outfits', () => {
  assert.deepEqual([1, 4, 5, 9, 10, 21].map(columnasDeResumen), [2, 2, 3, 3, 4, 4])
})
