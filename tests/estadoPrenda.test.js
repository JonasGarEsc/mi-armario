import test from 'node:test'
import assert from 'node:assert/strict'
import {
  distancia, escalaDePellizco, escalaParaGuardar, guardarEstadoPrenda, intentosDeGuardado, limitarEscala,
} from '../src/lib/estadoPrenda.js'

test('la escala se queda entre 0,8 y 1,2', () => {
  assert.equal(limitarEscala(2), 1.2)
  assert.equal(limitarEscala(0.1), 0.8)
  assert.equal(limitarEscala(1.05), 1.05)
  assert.equal(limitarEscala('x'), 1)
  assert.equal(limitarEscala(undefined), 1)
})

test('pellizcar escala por lo que se abren o cierran los dedos', () => {
  assert.equal(escalaDePellizco(1, 100, 110), 1.1)
  assert.equal(escalaDePellizco(1, 100, 50), 0.8) // tope por abajo
  assert.equal(escalaDePellizco(1.1, 100, 200), 1.2) // tope por arriba
  assert.equal(escalaDePellizco(1.05, 0, 80), 1.05) // sin distancia de partida, no cambia
  assert.equal(distancia({ x: 0, y: 0 }, { x: 3, y: 4 }), 5)
  assert.equal(escalaParaGuardar(1.0449), 1.04)
})

test('los intentos de guardado van de lo completo a lo básico', () => {
  const completo = { pos_x: 0, pos_y: 0, z_index: 3, ranura: 'torso', escala: 1.1, por_dentro: true }
  const intentos = intentosDeGuardado(completo)
  assert.deepEqual(intentos.map((i) => Object.keys(i)), [
    ['pos_x', 'pos_y', 'z_index', 'ranura', 'escala', 'por_dentro'],
    ['pos_x', 'pos_y', 'z_index', 'ranura'],
    ['pos_x', 'pos_y', 'z_index'],
  ])
  assert.equal(intentosDeGuardado({ pos_x: 1, pos_y: 2, z_index: 1 }).length, 1)
})

function falso(fallos) {
  const llamadas = []
  return {
    llamadas,
    from: () => ({ update: (fila) => ({ match: async () => { llamadas.push(Object.keys(fila).join()); return { error: llamadas.length <= fallos ? { message: 'no' } : null } } }) }),
  }
}

test('guarda con respaldo si faltan columnas', async () => {
  const peticion = { conjuntoId: 'c', prendaId: 'p', x: 0, y: 0, z: 3, ranura: 'torso', extra: { escala: 1.15, por_dentro: false } }
  const bien = falso(0)
  assert.equal(await guardarEstadoPrenda(bien, peticion), true)
  assert.equal(bien.llamadas.length, 1)

  const sinColumnas = falso(1)
  assert.equal(await guardarEstadoPrenda(sinColumnas, peticion), true)
  assert.deepEqual(sinColumnas.llamadas, ['pos_x,pos_y,z_index,ranura,escala,por_dentro', 'pos_x,pos_y,z_index,ranura'])

  assert.equal(await guardarEstadoPrenda(falso(9), peticion), false)
})
