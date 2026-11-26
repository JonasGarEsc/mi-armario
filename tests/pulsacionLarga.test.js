import test from 'node:test'
import assert from 'node:assert/strict'
import { crearDetectorPulsacionLarga } from '../src/lib/pulsacionLarga.js'

function reloj() {
  let tareas = []
  return {
    programar: (fn) => { tareas.push(fn); return fn },
    cancelar: (fn) => { tareas = tareas.filter((t) => t !== fn) },
    avanzar: () => { const ahora = tareas; tareas = []; ahora.forEach((fn) => fn()) },
    pendientes: () => tareas.length,
  }
}

function crear(extra = {}) {
  const relojFalso = reloj()
  let largas = 0
  const detector = crearDetectorPulsacionLarga({
    onLargo: () => { largas++ },
    programar: relojFalso.programar,
    cancelar: relojFalso.cancelar,
    ...extra,
  })
  return { detector, reloj: relojFalso, largas: () => largas }
}

test('quieto medio segundo abre el menú y el clic posterior no cuenta', () => {
  const { detector, reloj, largas } = crear()
  detector.iniciar({ x: 10, y: 10 })
  assert.equal(reloj.pendientes(), 1)

  reloj.avanzar()
  assert.equal(largas(), 1)

  detector.soltar()
  assert.equal(detector.consumirClic(), true)
  // El siguiente toque vuelve a abrir con normalidad.
  assert.equal(detector.consumirClic(), false)
})

test('si el dedo se mueve no hay pulsación larga y el clic se descarta', () => {
  const { detector, reloj, largas } = crear()
  detector.iniciar({ x: 10, y: 10 })
  detector.mover({ x: 10, y: 40 })
  assert.equal(reloj.pendientes(), 0)

  reloj.avanzar()
  assert.equal(largas(), 0)

  detector.soltar()
  assert.equal(detector.consumirClic(), true)
})

test('un temblor pequeño no cancela la pulsación', () => {
  const { detector, reloj, largas } = crear()
  detector.iniciar({ x: 10, y: 10 })
  detector.mover({ x: 14, y: 13 })
  assert.equal(reloj.pendientes(), 1)

  reloj.avanzar()
  assert.equal(largas(), 1)
})

test('un toque corto se suelta sin abrir el menú', () => {
  const { detector, reloj, largas } = crear()
  detector.iniciar({ x: 10, y: 10 })
  detector.soltar()

  reloj.avanzar()
  assert.equal(largas(), 0)
  assert.equal(detector.consumirClic(), false)
})

test('si el navegador cancela el gesto (scroll) no se abre nada', () => {
  const { detector, reloj, largas } = crear()
  detector.iniciar({ x: 10, y: 10 })
  detector.cancelar()

  reloj.avanzar()
  assert.equal(largas(), 0)
  assert.equal(detector.consumirClic(), true)
})

test('el tiempo de espera se puede acortar', () => {
  const { detector, reloj, largas } = crear({ espera: 200 })
  detector.iniciar({ x: 0, y: 0 })
  assert.equal(reloj.pendientes(), 1)
  reloj.avanzar()
  assert.equal(largas(), 1)
})
