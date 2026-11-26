import test from 'node:test'
import assert from 'node:assert/strict'
import { contarCopia, normalizarCopia } from '../src/lib/backup.js'

test('una copia vacía se normaliza con todas las tablas', () => {
  const copia = normalizarCopia({ prendas: [], conjuntos: [] })
  assert.deepEqual(copia.prendas, [])
  assert.deepEqual(copia.semanas, [])
  assert.deepEqual(copia.usos, [])
})

test('un archivo cualquiera no pasa por copia', () => {
  assert.throws(() => normalizarCopia({ hola: 'mundo' }), /copia/i)
})

test('el resumen cuenta lo que se va a restaurar', () => {
  const resumen = contarCopia({
    prendas: [{ id: '1' }, { id: '2' }],
    conjuntos: [{ id: '3' }],
    maletas: [],
  })
  assert.equal(resumen.prendas, 2)
  assert.equal(resumen.conjuntos, 1)
  assert.equal(resumen.maletas, 0)
})
