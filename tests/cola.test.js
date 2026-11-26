import test from 'node:test'
import assert from 'node:assert/strict'
import { procesarEnCola } from '../src/lib/cola.js'

const espera = (ms) => new Promise((r) => setTimeout(r, ms))

test('procesa todo sin pasar del límite de concurrencia', async () => {
  let enMarcha = 0
  let maximo = 0
  const visto = []
  const resultado = await procesarEnCola([1, 2, 3, 4, 5, 6, 7], async (n) => {
    enMarcha++
    maximo = Math.max(maximo, enMarcha)
    await espera(5)
    visto.push(n)
    enMarcha--
  }, { concurrencia: 3 })
  assert.equal(maximo, 3)
  assert.deepEqual(visto.sort(), [1, 2, 3, 4, 5, 6, 7])
  assert.deepEqual(resultado, { hechos: 7, fallos: 0, total: 7, cancelado: false })
})

test('cuenta los fallos, tanto false como excepciones, y sigue', async () => {
  const resultado = await procesarEnCola([1, 2, 3, 4], async (n) => {
    if (n === 2) return false
    if (n === 3) throw new Error('boom')
  })
  assert.equal(resultado.fallos, 2)
  assert.equal(resultado.hechos, 4)
})

test('informa del progreso tras cada tarea', async () => {
  const pasos = []
  await procesarEnCola([1, 2, 3], async () => {}, { concurrencia: 1, onProgreso: (p) => pasos.push(p.hechos) })
  assert.deepEqual(pasos, [1, 2, 3])
})

test('se puede cancelar: lo empezado acaba y no se empieza nada más', async () => {
  const control = new AbortController()
  let empezadas = 0
  const resultado = await procesarEnCola([1, 2, 3, 4, 5, 6], async () => {
    empezadas++
    if (empezadas === 2) control.abort()
    await espera(5)
  }, { concurrencia: 2, signal: control.signal })
  assert.equal(resultado.cancelado, true)
  assert.ok(empezadas < 6)
})

test('una lista vacía termina al instante', async () => {
  assert.deepEqual(await procesarEnCola([], async () => {}), { hechos: 0, fallos: 0, total: 0, cancelado: false })
})
