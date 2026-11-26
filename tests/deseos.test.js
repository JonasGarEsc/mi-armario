import test from 'node:test'
import assert from 'node:assert/strict'
import { combinaCon, combinan, resumenDeseos } from '../src/lib/deseos.js'
import { esDelArmario } from '../src/lib/filtros.js'

let n = 0
const prenda = (nombre, categoria, extra = {}) => ({ id: `p${++n}`, nombre, categorias: { nombre: categoria, tipos: { nombre: 'Ropa' } }, usos: [], ...extra })
const neutro = { colores: ['#111111'], familia_color: 'neutro' }
const rojo = { colores: ['#d01c1c'], familia_color: 'vivo' }
const azulVivo = { colores: ['#1c4fd0'], familia_color: 'vivo' }

test('el armario no incluye archivadas ni deseadas', () => {
  assert.equal(esDelArmario({}), true)
  assert.equal(esDelArmario({ archivada: true }), false)
  assert.equal(esDelArmario({ deseada: true }), false)
})

test('el neutro combina con todo y dos vivos distintos chocan', () => {
  assert.equal(combinan(prenda('a', 'Camisetas', neutro), prenda('b', 'Pantalones', rojo)), true)
  assert.equal(combinan(prenda('a', 'Camisetas', rojo), prenda('b', 'Pantalones', azulVivo)), false)
})

test('sin color conocido se le da el beneficio de la duda', () => {
  assert.equal(combinan(prenda('a', 'Camisetas'), prenda('b', 'Pantalones', rojo)), true)
})

test('la formalidad no puede distar más de un nivel', () => {
  assert.equal(combinan(prenda('a', 'Camisas', { ...neutro, formalidad: 4 }), prenda('b', 'Pantalones', { ...neutro, formalidad: 3 })), true)
  assert.equal(combinan(prenda('a', 'Camisas', { ...neutro, formalidad: 5 }), prenda('b', 'Pantalones', { ...neutro, formalidad: 1 })), false)
})

test('no se mezclan temporadas opuestas, pero entretiempo vale con todo', () => {
  assert.equal(combinan(prenda('a', 'Camisetas', { temporada: ['verano'] }), prenda('b', 'Pantalones', { temporada: ['invierno'] })), false)
  assert.equal(combinan(prenda('a', 'Camisetas', { temporada: ['verano'] }), prenda('b', 'Pantalones', { temporada: ['entretiempo'] })), true)
})

test('un top combina solo con pantalones y faldas; unos zapatos, con todo lo de vestir', () => {
  const armario = [
    prenda('Vaquero', 'Pantalones', neutro), prenda('Falda negra', 'Faldas', neutro), prenda('Camiseta', 'Camisetas', neutro),
    prenda('Zapatillas', 'Zapatillas', neutro), prenda('Vestido', 'Vestidos', neutro),
  ]
  const top = prenda('Top nuevo', 'Camisetas', rojo)
  assert.deepEqual(combinaCon(top, armario).map((p) => p.nombre), ['Vaquero', 'Falda negra'])
  const botas = prenda('Botas nuevas', 'Zapatillas', neutro)
  assert.deepEqual(combinaCon(botas, armario).map((p) => p.nombre), ['Vaquero', 'Falda negra', 'Camiseta', 'Vestido'])
})

test('no cuenta archivadas, deseadas ni lo que ya vas a donar', () => {
  const armario = [
    prenda('Vaquero', 'Pantalones', neutro), prenda('Archivado', 'Pantalones', { ...neutro, archivada: true }),
    prenda('Otro deseo', 'Pantalones', { ...neutro, deseada: true }), prenda('Para donar', 'Pantalones', { ...neutro, salida: 'donar' }),
  ]
  assert.deepEqual(combinaCon(prenda('Top', 'Camisetas', neutro), armario).map((p) => p.nombre), ['Vaquero'])
})

test('resumen de toda la lista', () => {
  const armario = [prenda('Vaquero', 'Pantalones', neutro)]
  const [r] = resumenDeseos([prenda('Top', 'Camisetas', neutro)], armario)
  assert.equal(r.hueco, 'torso')
  assert.equal(r.combina.length, 1)
})

test('algo que no se viste (un accesorio) no combina con nada', () => {
  assert.deepEqual(combinaCon(prenda('Bolso', 'Bolsos', neutro), [prenda('Vaquero', 'Pantalones', neutro)]), [])
})
