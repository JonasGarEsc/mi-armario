import test from 'node:test'
import assert from 'node:assert/strict'
import { conTiempoLimite } from '../src/lib/conTiempo.js'

test('devuelve el resultado cuando llega a tiempo', async () => {
  assert.equal(await conTiempoLimite(Promise.resolve('ok'), 100), 'ok')
})

test('deja de esperar cuando tarda demasiado y no lanza', async () => {
  const inicio = Date.now()
  assert.equal(await conTiempoLimite(new Promise(() => {}), 20), null)
  assert.ok(Date.now() - inicio < 1000)
})

test('un fallo tampoco impide seguir', async () => {
  assert.equal(await conTiempoLimite(Promise.reject(new Error('sin red')), 100), null)
})
