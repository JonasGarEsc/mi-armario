import test from 'node:test'
import assert from 'node:assert/strict'
import {
  agregarAlHistorial, encuadreVisible, medidasDeLienzo, puntoDePincel, puntosDelTrazo, radioDePincel,
} from '../src/lib/retoque.js'

const cerca = (a, b, margen = 1e-6) => Math.abs(a - b) < margen

test('el pincel convierte la pantalla en coordenadas del lienzo', () => {
  const rect = { left: 10, top: 20, width: 200, height: 100 }
  const punto = puntoDePincel(60, 70, rect, 400, 200)
  assert.equal(punto.x, 100)
  assert.equal(punto.y, 100)
})

test('el pincel mantiene el tamaño en pantalla aunque el lienzo sea mayor', () => {
  assert.equal(radioDePincel(40, 900, 450), 40)
  assert.equal(radioDePincel(10, 900, 450), 10)
  assert.equal(radioDePincel(2, 1, 900), 1)
})

test('un trazo rápido se rellena con puntos intermedios', () => {
  const puntos = puntosDelTrazo(0, 0, 10, 0, 4)
  assert.equal(puntos.length, 3)
  assert.deepEqual(puntos[0], [10 / 3, 0])
  assert.deepEqual(puntos[2], [10, 0])

  for (let i = 1; i < puntos.length; i++) {
    const [x0, y0] = puntos[i - 1]
    const [x1, y1] = puntos[i]
    assert.ok(Math.hypot(x1 - x0, y1 - y0) <= 4)
  }
})

test('un toque sin movimiento pinta un solo punto', () => {
  assert.deepEqual(puntosDelTrazo(5, 6, 5, 6, 4), [[5, 6]])
})

test('el historial se queda con las últimas instantáneas sin mutar el original', () => {
  const historial = [{ n: 1 }]
  const nuevo = agregarAlHistorial(historial, { n: 2 }, 2)
  assert.equal(nuevo.length, 2)
  assert.equal(historial.length, 1)

  const recortado = agregarAlHistorial(nuevo, { n: 3 }, 2)
  assert.deepEqual(recortado.map(x => x.n), [2, 3])
  assert.deepEqual(nuevo.map(x => x.n), [1, 2])
})

test('el lienzo conserva la proporción sin agrandar fotos pequeñas', () => {
  assert.deepEqual(medidasDeLienzo(900, 1200), { ancho: 900, alto: 1200 })
  assert.deepEqual(medidasDeLienzo(3200, 1600), { ancho: 1200, alto: 600 })
  assert.deepEqual(medidasDeLienzo(1200, 1600, 800), { ancho: 600, alto: 800 })
  assert.deepEqual(medidasDeLienzo(0, 0), { ancho: 1, alto: 1 })
})

test('una caja que ocupa toda la foto no cambia el encuadre', () => {
  const encuadre = encuadreVisible({ x: 0, y: 0, w: 1, h: 1, relacion: 1 }, 100, 100)
  assert.ok(cerca(encuadre.escala, 1))
  assert.ok(cerca(encuadre.x, 0))
  assert.ok(cerca(encuadre.y, 0))
  assert.equal(encuadre.transformOrigin, '0 0')
})

test('el encuadre quita los márgenes transparentes y respeta el hueco', () => {
  const encuadre = encuadreVisible({ x: 0.25, y: 0.25, w: 0.5, h: 0.5, relacion: 1 }, 200, 100)
  assert.ok(cerca(encuadre.escala, 2))
  assert.ok(cerca(encuadre.x, -100))
  assert.ok(cerca(encuadre.y, -50))
})

test('una foto sin transparencia o sin medidas deja el encuadre normal', () => {
  assert.equal(encuadreVisible(null, 100, 100), null)
  assert.equal(encuadreVisible({ x: 0, y: 0, w: 0, h: 1, relacion: 1 }, 100, 100), null)
  assert.equal(encuadreVisible({ x: 0, y: 0, w: 1, h: 1, relacion: 1 }, 0, 100), null)
})
