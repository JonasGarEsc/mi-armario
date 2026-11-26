import test from 'node:test'
import assert from 'node:assert/strict'
import { encajarCaja } from '../src/lib/recorte.js'

const cerca = (a, b, margen = 1e-9) => Math.abs(a - b) < margen

test('la parte visible de la prenda cubre el hueco', () => {
  const caja = { x: 0.2, y: 0.1, w: 0.6, h: 0.8, relacion: 0.8 }
  for (const aspecto of [1, 42 / 31, 34 / 50, 0.5, 2]) {
    const encaje = encajarCaja(caja, aspecto)
    assert.ok(caja.w * (encaje.ancho / 100) >= 1 - 1e-9, `ancho insuficiente en ${aspecto}`)
    assert.ok(caja.h * (encaje.alto / 100) >= 1 - 1e-9, `alto insuficiente en ${aspecto}`)
    assert.ok(cerca((encaje.ancho / encaje.alto) * aspecto, caja.relacion), 'se deforma')
  }
})

test('sin caja visible no hay encaje', () => {
  assert.equal(encajarCaja(null, 1), null)
  assert.equal(encajarCaja({ x: 0, y: 0, w: 0, h: 0, relacion: 1 }, 1), null)
})

test('una foto que ya llena el marco se estira solo el margen', () => {
  const encaje = encajarCaja({ x: 0, y: 0, w: 1, h: 1, relacion: 1 }, 1, 1.03)
  assert.ok(cerca(encaje.ancho, 103))
  assert.ok(cerca(encaje.alto, 103))
  assert.ok(cerca(encaje.izquierda, -1.5))
  assert.ok(cerca(encaje.arriba, -1.5))
})
