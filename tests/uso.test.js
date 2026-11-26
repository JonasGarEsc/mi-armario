import test from 'node:test'
import assert from 'node:assert/strict'
import { cuandoFue, desdeSemana, nombreDelDia, outfitsSinUso, usosPorAnadir } from '../src/lib/uso.js'

const hoy = '2026-11-26' // jueves
const outfit = (id, fecha, prendas = ['a', 'b']) => ({ id, nombre: id, fecha, conjunto_prenda: prendas.map((prenda_id) => ({ prenda_id })) })

test('la semana empieza el lunes', () => {
  assert.equal(desdeSemana(hoy), '2026-11-23')
  assert.equal(desdeSemana('2026-11-29'), '2026-11-23')
})

test('pregunta por los outfits de esta semana ya pasados y sin uso, el más reciente primero', () => {
  const conjuntos = [outfit('lun', '2026-11-23'), outfit('mie', '2026-11-25'), outfit('hoy', '2026-11-26'), outfit('man', '2026-11-27'), outfit('pasada', '2026-11-20')]
  assert.deepEqual(outfitsSinUso(conjuntos, [], hoy).map((c) => c.id), ['mie', 'lun'])
})

test('si alguna prenda ya tiene uso ese día, no se pregunta', () => {
  const conjuntos = [outfit('mie', '2026-11-25'), outfit('mar', '2026-11-24')]
  const usos = [{ prenda_id: 'a', fecha: '2026-11-25' }, { prenda_id: 'zzz', fecha: '2026-11-24' }]
  assert.deepEqual(outfitsSinUso(conjuntos, usos, hoy).map((c) => c.id), ['mar'])
})

test('lo ya contestado no vuelve a salir, ni los outfits vacíos', () => {
  const conjuntos = [outfit('mie', '2026-11-25'), outfit('vacio', '2026-11-24', [])]
  assert.deepEqual(outfitsSinUso(conjuntos, [], hoy, ['mie']), [])
})

test('cuándo fue, con palabras', () => {
  assert.equal(cuandoFue('2026-11-25', hoy), 'ayer')
  assert.equal(cuandoFue('2026-11-24', hoy), 'anteayer')
  assert.equal(cuandoFue('2026-11-23', hoy), 'el lunes')
  assert.equal(nombreDelDia('2026-11-29'), 'domingo')
})

test('no se duplican usos del mismo día', () => {
  const usos = [{ prenda_id: 'a', fecha: '2026-11-25' }, { prenda_id: 'b', fecha: '2026-11-20' }]
  assert.deepEqual(usosPorAnadir(['a', 'b', 'b', 'c'], '2026-11-25', usos), [
    { prenda_id: 'b', fecha: '2026-11-25' }, { prenda_id: 'c', fecha: '2026-11-25' },
  ])
})
