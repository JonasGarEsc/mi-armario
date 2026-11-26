import test from 'node:test'
import assert from 'node:assert/strict'
import {
  aptaParaClima,
  elegirPropuesta,
  endpointPushValido,
  fechaLocal,
  horaLocal,
  ranuraDe,
  textoPropuesta,
} from '../supabase/functions/aviso-diario/seleccion.js'
import { decodificarClave, motivoSinSoporte, soportado } from '../src/lib/push.js'

const prenda = (id, nombre, extra = {}) => ({
  id, nombre, temporada: null, abrigo: null, archivada: false, deseada: false, ...extra,
})

test('solo se aceptan endpoints https de servicios push conocidos', () => {
  for (const url of [
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/abc',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ]) assert.equal(endpointPushValido(url), true, url)

  for (const url of [
    'http://fcm.googleapis.com/fcm/send/abc', // sin https
    'https://fcm.googleapis.com.evil.test/abc', // dominio parecido
    'https://evil.test/fcm.googleapis.com',
    'https://usuario:clave@fcm.googleapis.com/abc', // credenciales
    'no es una url',
    '',
  ]) assert.equal(endpointPushValido(url), false, url)
})

test('la hora y la fecha se calculan en la zona de la suscripción', () => {
  const invierno = new Date('2026-11-26T07:30:00Z')
  assert.equal(horaLocal(invierno, 'Europe/Madrid'), 8)
  assert.equal(horaLocal(invierno, 'America/New_York'), 2)
  assert.equal(fechaLocal(invierno, 'Europe/Madrid'), '2026-11-26')

  const casiMedianoche = new Date('2026-11-26T23:30:00Z')
  assert.equal(horaLocal(casiMedianoche, 'Europe/Madrid'), 0)
  assert.equal(fechaLocal(casiMedianoche, 'Europe/Madrid'), '2026-11-27')

  assert.equal(horaLocal(invierno, 'Zona/QueNoExiste'), null)
  assert.equal(fechaLocal(invierno, 'Zona/QueNoExiste'), null)
})

test('la propuesta es una prenda de arriba y otra de abajo', () => {
  const prendas = [
    prenda('c', 'Camiseta blanca', { temporada: ['verano'] }),
    prenda('b', 'Vaqueros azules'),
    prenda('a', 'Zapatillas'), // no es ropa del día
    prenda('d', 'Chaqueta de abrigo'),
  ]
  const elegida = elegirPropuesta(prendas, { temp: 26, lluvia: false }, '2026-11-26')
  assert.equal(elegida.arriba.id, 'c')
  assert.equal(elegida.abajo.id, 'b')
  assert.equal(elegida.vestido, null)
  assert.equal(ranuraDe(prendas[2]), null)
})

test('descarta archivadas, deseadas y lo que no pega con el tiempo', () => {
  const prendas = [
    prenda('archivada', 'Camiseta vieja', { archivada: true }),
    prenda('deseada', 'Camiseta soñada', { deseada: true }),
    prenda('invierno', 'Jersey de lana', { temporada: ['invierno'] }),
    prenda('calor', 'Camiseta de lino', { temporada: ['verano'] }),
    prenda('pantalon', 'Pantalón corto'),
  ]
  const elegida = elegirPropuesta(prendas, { temp: 30, lluvia: false }, 's')
  assert.equal(elegida.arriba.id, 'calor')

  assert.equal(aptaParaClima(prenda('x', 'Plumífero', { abrigo: 5 }), { temp: 30 }), false)
  assert.equal(aptaParaClima(prenda('y', 'Sandalia'), { temp: 22, lluvia: true }), false)
})

test('sin pareja de arriba y abajo usa un vestido', () => {
  const elegida = elegirPropuesta([
    prenda('v', 'Vestido negro'),
    prenda('p', 'Pantalón vaquero'),
  ], null, 'dia')
  assert.equal(elegida.vestido.id, 'v')
  assert.equal(elegida.arriba, null)
})

test('la elección es estable con la misma semilla y no hay propuesta sin ropa', () => {
  const prendas = [
    prenda('a1', 'Camisa blanca'), prenda('a2', 'Camiseta gris'),
    prenda('b1', 'Pantalón negro'), prenda('b2', 'Vaqueros'),
  ]
  const una = elegirPropuesta(prendas, null, '2026-11-26')
  const otra = elegirPropuesta(prendas, null, '2026-11-26')
  assert.deepEqual(una, otra)
  assert.equal(elegirPropuesta([prenda('z', 'Zapatos')], null, 'x'), null)
})

test('el texto del aviso nombra la propuesta y el tiempo', () => {
  const propuesta = {
    arriba: prenda('a', 'Camiseta blanca', { temporada: ['verano'] }),
    abajo: prenda('b', 'Vaqueros'),
    vestido: null,
  }
  const conTiempo = textoPropuesta(propuesta, { temp: 21.6, lluvia: false })
  assert.equal(conTiempo.titulo, 'Tu propuesta de hoy')
  assert.match(conTiempo.cuerpo, /Camiseta blanca y Vaqueros/)
  assert.match(conTiempo.cuerpo, /22 °C/)

  const conLluvia = textoPropuesta(propuesta, { temp: 10, lluvia: true })
  assert.match(conLluvia.cuerpo, /10 °C y lluvia/)

  const sinTiempo = textoPropuesta(propuesta, null)
  assert.doesNotMatch(sinTiempo.cuerpo, /°C/)
  assert.equal(textoPropuesta(null, null), null)
})

test('los avisos no se dan por soportados sin clave ni navegador', () => {
  assert.equal(soportado(), false)
  assert.equal(motivoSinSoporte(), 'Faltan los avisos en esta instalación (VITE_VAPID_PUBLICA).')
  assert.deepEqual(Array.from(decodificarClave('AQIDBA')), [1, 2, 3, 4])
})
