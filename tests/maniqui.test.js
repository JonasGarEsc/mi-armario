import test from 'node:test'
import assert from 'node:assert/strict'
import { RANURAS, dentroDelManiqui, inferirRanura, ranuraMasCercana } from '../src/lib/maniqui.js'

test('una camiseta va al torso', () => {
  assert.equal(inferirRanura('Camisetas'), 'torso')
  assert.equal(inferirRanura('Ropa', 'Camisas', 'Camisa de lino'), 'torso')
})

test('unos zapatos van a los pies, aunque el tipo diga calzado', () => {
  assert.equal(inferirRanura('Calzado', 'Zapatillas'), 'pies')
  assert.equal(inferirRanura('Botas de agua'), 'pies')
})

test('un vestido cubre el cuerpo y una chaqueta va encima', () => {
  assert.equal(inferirRanura('Vestidos', 'Vestido negro'), 'vestido')
  assert.equal(inferirRanura('Abrigos', 'Trenca'), 'abrigo')
})

test('lo que no se reconoce cae en la ranura más cercana', () => {
  const centroTorso = RANURAS.torso.x + RANURAS.torso.w / 2
  const centroY = RANURAS.torso.y + RANURAS.torso.h / 2
  assert.equal(ranuraMasCercana(centroTorso, centroY), 'torso')
})

test('fuera del cuerpo la prenda queda libre', () => {
  assert.equal(dentroDelManiqui(50, 50), true)
  assert.equal(dentroDelManiqui(2, 50), false)
})

test('a los lados del maniquí hay sitio para dejar la ropa quitada', () => {
  assert.equal(dentroDelManiqui(20, 30), false)
  assert.equal(dentroDelManiqui(80, 75), false)
  assert.equal(dentroDelManiqui(36, 40), true) // sobre un brazo
  assert.equal(dentroDelManiqui(50, 92), true) // sobre los pies
})
