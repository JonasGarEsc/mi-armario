import test from 'node:test'
import assert from 'node:assert/strict'
import { cerrarHoja, curvaAsentamiento, destinoDelGesto } from '../src/lib/gestos.js'

test('arrastrar más de un cuarto de pantalla cambia de panel', () => {
  assert.equal(destinoDelGesto(1, 3, -120, 0, 400), 2)
  assert.equal(destinoDelGesto(1, 3, 120, 0, 400), 0)
  assert.equal(destinoDelGesto(1, 3, -60, 0, 400), 1)
})

test('un lanzamiento rápido cambia de panel aunque el recorrido sea corto', () => {
  assert.equal(destinoDelGesto(0, 3, -40, -0.8, 400), 1)
})

test('no se pasa del primer ni del último panel', () => {
  assert.equal(destinoDelGesto(0, 3, 300, 1, 400), 0)
  assert.equal(destinoDelGesto(2, 3, -300, -1, 400), 2)
})

test('si el dedo vuelve atrás, el lanzamiento no cuenta', () => {
  assert.equal(destinoDelGesto(1, 3, 20, -0.8, 400), 1)
})

test('la hoja se cierra al bajarla bastante o al lanzarla', () => {
  assert.equal(cerrarHoja(200, 0, 600), true)
  assert.equal(cerrarHoja(40, 0.9, 600), true)
  assert.equal(cerrarHoja(40, 0.1, 600), false)
  assert.equal(cerrarHoja(-30, -1, 600), false)
})

test('al soltar, la animación sale a la misma velocidad que el dedo', () => {
  const pendienteInicial = (curva) => {
    const [x1, y1] = curva.match(/[\d.]+/g).map(Number)
    return y1 / x1
  }
  for (const [falta, v] of [[-282, -0.72], [-100, -3], [-390, -1.5], [300, 0.4]]) {
    const { duracion, curva } = curvaAsentamiento(falta, v)
    const inicial = (pendienteInicial(curva) * Math.abs(falta)) / duracion // px/ms
    assert.ok(Math.abs(inicial - Math.abs(v)) < 0.01, `${falta}, ${v}: sale a ${inicial}`)
  }
})

test('sin velocidad a favor, la animación arranca desde parada', () => {
  assert.match(curvaAsentamiento(-200, 0).curva, /^cubic-bezier\(0\.22, 0, /)
  assert.match(curvaAsentamiento(-200, 1).curva, /^cubic-bezier\(0\.22, 0, /)
  assert.equal(curvaAsentamiento(0.4, 1).duracion, 0)
})
