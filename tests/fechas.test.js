import test from 'node:test'
import assert from 'node:assert/strict'
import {
  celdasMes, diasDeSemana, etiquetaRango, finDeSemana, isoLocal, lunesDe, mismoDia,
} from '../src/lib/fechas.js'

test('el lunes de un domingo es seis días antes', () => {
  assert.equal(isoLocal(lunesDe(new Date(2026, 10, 6))), '2026-11-02')
  assert.equal(isoLocal(finDeSemana(new Date(2026, 10, 30))), '2026-12-06')
})

test('la semana elegida va de lunes a domingo', () => {
  const dias = diasDeSemana(new Date(2026, 10, 30))
  assert.equal(dias.length, 7)
  assert.equal(isoLocal(dias[0]), '2026-11-30')
  assert.equal(isoLocal(dias[6]), '2026-12-06')
})

test('el rango se escribe corto dentro del mismo mes y con meses al cambiar', () => {
  assert.equal(etiquetaRango('2026-11-02', '2026-11-08'), '2–8 nov')
  assert.equal(etiquetaRango('2026-11-30', '2026-12-06'), '30 nov – 6 dic')
  assert.equal(etiquetaRango('2026-12-28', '2027-01-03'), '28 dic 2026 – 3 ene 2027')
})

test('el calendario empieza en lunes y rellena la última fila', () => {
  const celdas = celdasMes(2026, 10) // noviembre de 2026 empieza en domingo
  assert.equal(celdas.length % 7, 0)
  assert.equal(celdas[0], null)
  assert.equal(celdas[6].getDate(), 1)
})

test('mismoDia compara solo la fecha', () => {
  assert.equal(mismoDia(new Date(2026, 10, 30, 23), new Date(2026, 10, 30, 1)), true)
  assert.equal(mismoDia(new Date(2026, 10, 30), new Date(2026, 11, 1)), false)
})
