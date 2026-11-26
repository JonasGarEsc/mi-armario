import test from 'node:test'
import assert from 'node:assert/strict'
import { coloresDominantes, familiaDeColor, hexARgb, oklabAHex, oklchDeHex, rgbAOklab } from '../src/lib/colores.js'

// Imagen sintética RGBA: lista de [r, g, b, a, cantidad].
function imagen(trozos) {
  const datos = []
  for (const [r, g, b, a, n] of trozos) for (let i = 0; i < n; i++) datos.push(r, g, b, a)
  return Uint8ClampedArray.from(datos)
}
const cercaDe = (hex, objetivo, margen = 40) => {
  const [r, g, b] = hexARgb(hex)
  const [R, G, B] = hexARgb(objetivo)
  return Math.abs(r - R) < margen && Math.abs(g - G) < margen && Math.abs(b - B) < margen
}

test('OKLab ida y vuelta conserva el color', () => {
  for (const hex of ['#ff0000', '#1d4ed8', '#808080', '#f4e1c1']) {
    const lab = rgbAOklab(...hexARgb(hex))
    assert.equal(oklabAHex(...lab), hex)
  }
})

test('el color mayoritario va primero y el fondo transparente no cuenta', () => {
  const datos = imagen([[200, 30, 30, 255, 700], [30, 60, 200, 255, 250], [0, 255, 0, 0, 5000]])
  const colores = coloresDominantes(datos)
  assert.ok(cercaDe(colores[0], '#c81e1e'), `primero: ${colores[0]}`)
  assert.ok(cercaDe(colores[1], '#1e3cc8'), `segundo: ${colores[1]}`)
  assert.equal(colores.length, 2)
})

test('un reflejo blanco minoritario no cuenta, pero una camiseta blanca sí es blanca', () => {
  const roja = coloresDominantes(imagen([[200, 30, 30, 255, 800], [250, 250, 250, 255, 120]]))
  assert.equal(roja.length, 1)
  const blanca = coloresDominantes(imagen([[248, 248, 248, 255, 900], [200, 30, 30, 255, 100]]))
  assert.ok(cercaDe(blanca[0], '#f8f8f8', 12), `primero: ${blanca[0]}`)
})

test('negro dominante con un logo blanco pequeño sigue siendo negro', () => {
  const colores = coloresDominantes(imagen([[15, 15, 15, 255, 900], [250, 250, 250, 255, 60]]))
  assert.ok(cercaDe(colores[0], '#0f0f0f', 12), `primero: ${colores[0]}`)
})

test('sin píxeles opacos no hay colores', () => {
  assert.deepEqual(coloresDominantes(imagen([[10, 10, 10, 0, 100]])), [])
})

test('familias de color', () => {
  assert.equal(familiaDeColor('#111111'), 'neutro')
  assert.equal(familiaDeColor('#d9d9d9'), 'neutro')
  assert.equal(familiaDeColor('#ff1e1e'), 'vivo')
  assert.equal(familiaDeColor('#f4c6d0'), 'pastel')
  assert.equal(familiaDeColor('#8b5a2b'), 'tierra')
  assert.equal(familiaDeColor('#b5651d'), 'tierra')
  assert.equal(familiaDeColor('#4f6f9f'), 'frío')
  assert.equal(familiaDeColor('#9b2c2c'), 'cálido')
  assert.equal(familiaDeColor('#d4a017'), 'cálido')
  assert.equal(familiaDeColor('no es un color'), null)
  assert.ok(oklchDeHex('#ff0000').C > 0.2)
})
