import test from 'node:test'
import assert from 'node:assert/strict'
import { encajarCaja } from '../src/lib/recorte.js'

const cerca = (a, b, margen = 1e-9) => Math.abs(a - b) < margen

test('la prenda cabe en el hueco sin deformarse ni agrandarse de más', () => {
  const caja = { x: 0.2, y: 0.1, w: 0.6, h: 0.8, relacion: 0.8 }
  for (const aspecto of [1, 42 / 31, 34 / 50, 0.5, 2]) {
    const encaje = encajarCaja(caja, aspecto, null, 1)
    const visibleAncho = caja.w * (encaje.ancho / 100)
    const visibleAlto = caja.h * (encaje.alto / 100)
    assert.ok(visibleAncho <= 1 + 1e-9, `se sale a lo ancho en ${aspecto}`)
    assert.ok(visibleAlto <= 1 + 1e-9, `se sale a lo alto en ${aspecto}`)
    assert.ok(cerca(Math.max(visibleAncho, visibleAlto), 1), 'no aprovecha el hueco')
    assert.ok(cerca((encaje.ancho / encaje.alto) * aspecto, caja.relacion), 'se deforma')
  }
})

test('sin caja visible no hay encaje', () => {
  assert.equal(encajarCaja(null, 1), null)
  assert.equal(encajarCaja({ x: 0, y: 0, w: 0, h: 0, relacion: 1 }, 1), null)
})

test('una foto que ya llena el marco solo usa la holgura', () => {
  const encaje = encajarCaja({ x: 0, y: 0, w: 1, h: 1, relacion: 1 }, 1, null, 1.03)
  assert.ok(cerca(encaje.ancho, 103))
  assert.ok(cerca(encaje.alto, 103))
  assert.ok(cerca(encaje.izquierda, -1.5))
  assert.ok(cerca(encaje.arriba, -1.5))
})
