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

import { fuenteDelDia, mismoDiaAnioAnterior, resumenesDiarios } from '../src/lib/clima.js'

test('hasta 15 días vista, previsión; más lejos, el año anterior', () => {
  const hoy = '2026-11-26'
  assert.deepEqual(fuenteDelDia('2026-11-26', hoy), { fuente: 'prevision', fecha: '2026-11-26' })
  assert.deepEqual(fuenteDelDia('2026-12-11', hoy), { fuente: 'prevision', fecha: '2026-12-11' })
  assert.deepEqual(fuenteDelDia('2026-12-12', hoy), { fuente: 'historico', fecha: '2025-12-12' })
  assert.deepEqual(fuenteDelDia('2027-03-05', hoy), { fuente: 'historico', fecha: '2026-03-05' })
  // Un día ya pasado se mira tal cual, no un año antes.
  assert.deepEqual(fuenteDelDia('2026-10-01', hoy), { fuente: 'historico', fecha: '2026-10-01' })
})

test('el 29 de febrero pasa al 28 del año anterior', () => {
  assert.equal(mismoDiaAnioAnterior('2028-02-29'), '2027-02-28')
  assert.equal(mismoDiaAnioAnterior('2026-07-14'), '2025-07-14')
})

test('resume todos los días de una respuesta', () => {
  const json = { daily: { time: ['2026-12-01', '2026-12-02'], apparent_temperature_max: [20, 10], apparent_temperature_min: [10, 2], precipitation_sum: [0, 5] } }
  const dias = resumenesDiarios(json)
  assert.equal(dias.length, 2)
  assert.equal(dias[0].fecha, '2026-12-01')
  assert.equal(dias[0].lluvia, false)
  assert.equal(dias[1].lluvia, true)
  assert.deepEqual(resumenesDiarios({}), [])
})
