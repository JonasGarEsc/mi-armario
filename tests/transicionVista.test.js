import test from 'node:test'
import assert from 'node:assert/strict'
import { conTransicionVista, movimientoReducido, nombreVistaPrenda } from '../src/lib/transicionVista.js'

test('nombre único y válido para la transición, sin caracteres raros', () => {
  assert.equal(nombreVistaPrenda('abc-123'), 'foto-prenda-abc-123')
  assert.equal(nombreVistaPrenda('a b/c:d'), 'foto-prenda-abcd')
  assert.equal(nombreVistaPrenda(undefined), 'foto-prenda-')
})

test('sin la API del navegador se abre sin animación', () => {
  let cambios = 0
  const resultado = conTransicionVista(() => { cambios++ }, { documento: {}, ventana: {} })
  assert.equal(resultado, null)
  assert.equal(cambios, 1)
})

test('con la API, el cambio ocurre dentro de la transición', () => {
  const dentro = []
  let llamada = false
  const documento = {
    startViewTransition(cambiar) {
      llamada = true
      dentro.push(true)
      cambiar()
      dentro.push(false)
      return { finished: Promise.resolve() }
    },
  }
  let cambios = 0
  const resultado = conTransicionVista(() => { cambios++ }, {
    documento,
    ventana: { matchMedia: () => ({ matches: false }) },
  })
  assert.equal(llamada, true)
  assert.equal(cambios, 1)
  assert.deepEqual(dentro, [true, false])
  assert.equal(typeof resultado.finished.then, 'function')
})

test('con movimiento reducido no se anima', () => {
  let empezada = false
  let cambios = 0
  const resultado = conTransicionVista(() => { cambios++ }, {
    documento: { startViewTransition: () => { empezada = true } },
    ventana: { matchMedia: () => ({ matches: true }) },
  })
  assert.equal(empezada, false)
  assert.equal(resultado, null)
  assert.equal(cambios, 1)
})

test('si la transición falla, la acción se hace igual', () => {
  let cambios = 0
  const resultado = conTransicionVista(() => { cambios++ }, {
    documento: { startViewTransition: () => { throw new Error('sin soporte real') } },
    ventana: { matchMedia: () => ({ matches: false }) },
  })
  assert.equal(resultado, null)
  assert.equal(cambios, 1)
})

test('movimientoReducido no revienta sin matchMedia', () => {
  assert.equal(movimientoReducido(undefined), false)
  assert.equal(movimientoReducido({}), false)
})
