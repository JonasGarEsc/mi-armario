import test from 'node:test'
import assert from 'node:assert/strict'
import { limpiarTexto, pendientes, yaEsta } from '../src/lib/checklistMaleta.js'

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
