import test from 'node:test'
import assert from 'node:assert/strict'
import { resumenClima } from '../src/lib/clima.js'
import { semanaNuevaPara, semanaParaFecha } from '../src/lib/semanas.js'

const respuesta = (max, min, prob = 0, suma = 0) => ({
  daily: { apparent_temperature_max: [max], apparent_temperature_min: [min], precipitation_probability_max: [prob], precipitation_sum: [suma] },
})

test('la temperatura del día pesa más la máxima que la mínima', () => {
  const c = resumenClima(respuesta(20, 10))
  assert.equal(c.temp, 16)
  assert.equal(c.max, 20)
  assert.equal(c.min, 10)
})

test('llueve con probabilidad alta o con mucha precipitación', () => {
  assert.equal(resumenClima(respuesta(15, 8, 20, 0)).lluvia, false)
  assert.equal(resumenClima(respuesta(15, 8, 70, 0)).lluvia, true)
  assert.equal(resumenClima(respuesta(15, 8, 10, 4)).lluvia, true)
})

test('una respuesta rota no da clima', () => {
  assert.equal(resumenClima(null), null)
  assert.equal(resumenClima({ daily: {} }), null)
})

test('encuentra la semana que contiene un día', () => {
  const semanas = [
    { id: 'a', fecha_inicio: '2026-11-16', fecha_fin: '2026-11-22' },
    { id: 'b', fecha_inicio: '2026-11-23', fecha_fin: '2026-11-29' },
  ]
  assert.equal(semanaParaFecha(semanas, '2026-11-26').id, 'b')
  assert.equal(semanaParaFecha(semanas, '2026-11-22').id, 'a')
  assert.equal(semanaParaFecha(semanas, '2026-12-02'), null)
  assert.equal(semanaParaFecha(null, '2026-12-02'), null)
})

test('una semana nueva va de lunes a domingo', () => {
  const s = semanaNuevaPara('2026-11-26') // jueves
  assert.equal(s.fecha_inicio, '2026-11-23')
  assert.equal(s.fecha_fin, '2026-11-29')
  assert.equal(s.nombre, '23–29 nov')
})
