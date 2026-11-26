import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ESCALA_MAX, ESCALA_MIN, distancia, escalaDePellizco, escalaParaGuardar, guardarEstadoPrenda, limitarEscala, siguienteTamano,
} from '../src/lib/estadoPrenda.js'

test('la escala se queda entre 0,8 y 1,2', () => {
  assert.equal(limitarEscala(2), 1.2)
  assert.equal(limitarEscala(0.1), 0.8)
  assert.equal(limitarEscala(1.05), 1.05)
  assert.equal(limitarEscala('x'), 1)
  assert.equal(limitarEscala(undefined), 1)
})

test('doble toque alterna entre mediano, grande y pequeño', () => {
  assert.equal(siguienteTamano(1), ESCALA_MAX)
  assert.equal(siguienteTamano(ESCALA_MAX), ESCALA_MIN)
  assert.equal(siguienteTamano(ESCALA_MIN), 1)

  // Valores intermedios de un pellizco
  assert.equal(siguienteTamano(0.85), 1)
  assert.equal(siguienteTamano(0.99), 1)
  assert.equal(siguienteTamano(1.05), ESCALA_MAX)
  assert.equal(siguienteTamano(1.19), ESCALA_MAX)

  // Fuera de rango o sin valor
  assert.equal(siguienteTamano(0.5), 1)
  assert.equal(siguienteTamano(2), ESCALA_MIN)
  assert.equal(siguienteTamano(undefined), ESCALA_MAX)
})

test('pellizcar escala por lo que se abren o cierran los dedos', () => {
  assert.equal(escalaDePellizco(1, 100, 110), 1.1)
  assert.equal(escalaDePellizco(1, 100, 50), 0.8) // tope por abajo
  assert.equal(escalaDePellizco(1.1, 100, 200), 1.2) // tope por arriba
  assert.equal(escalaDePellizco(1.05, 0, 80), 1.05) // sin distancia de partida, no cambia
  assert.equal(distancia({ x: 0, y: 0 }, { x: 3, y: 4 }), 5)
  assert.equal(escalaParaGuardar(1.0449), 1.04)
})

function falso(fallos) {
  const llamadas = []
  return {
    llamadas,
    from: () => ({ update: (fila) => ({ match: async () => { llamadas.push(Object.keys(fila).join()); return { error: llamadas.length <= fallos ? { message: 'no' } : null } } }) }),
  }
}

test('guarda el estado completo en un solo intento y avisa si falla', async () => {
  const peticion = { conjuntoId: 'c', prendaId: 'p', x: 0, y: 0, z: 3, ranura: 'torso', extra: { escala: 1.15, por_dentro: false } }
  const bien = falso(0)
  assert.equal(await guardarEstadoPrenda(bien, peticion), true)
  assert.deepEqual(bien.llamadas, ['pos_x,pos_y,z_index,ranura,escala,por_dentro'])

  const falla = falso(1)
  assert.equal(await guardarEstadoPrenda(falla, peticion), false)
  assert.equal(falla.llamadas.length, 1)
})
