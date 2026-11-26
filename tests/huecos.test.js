import test from 'node:test'
import assert from 'node:assert/strict'
import { huecosDelArmario } from '../src/lib/huecos.js'

let n = 0
const prenda = (nombre, categoria, extra = {}) => ({
  id: `h${++n}`, nombre, categorias: { nombre: categoria, tipos: { nombre: 'Ropa' } }, usos: [], creado_en: '2026-01-01T00:00:00Z', ...extra,
})
// Un color que no coincide con ningún básico, pero declarado neutro: combina con todo.
const neutro = { colores: ['#a33f6b'], familia_color: 'neutro' }

test('propone hasta tres huecos, de más a menos combinaciones', () => {
  const armario = [
    prenda('Camiseta 1', 'Camisetas', neutro), prenda('Camiseta 2', 'Camisetas', neutro),
    prenda('Pantalón 1', 'Pantalones', neutro), prenda('Pantalón 2', 'Pantalones', neutro), prenda('Pantalón 3', 'Pantalones', neutro),
    prenda('Vestido', 'Vestidos', neutro),
  ]
  const huecos = huecosDelArmario(armario)
  assert.equal(huecos.length, 3)
  assert.equal(huecos[0].hueco, 'pies')
  assert.equal(huecos[0].etiqueta, 'unos zapatos blancos')
  // Dos arriba × tres abajo, más el vestido: el calzado que falta abre 7 conjuntos.
  assert.equal(huecos[0].ganancia, 7)
  assert.ok(huecos.every((h) => h.ganancia > 0))
})

test('no cuenta archivadas, deseadas ni prendas de salida', () => {
  const armario = [
    prenda('Camiseta', 'Camisetas', neutro),
    prenda('Pantalón', 'Pantalones', neutro), prenda('Vaquero', 'Pantalones', neutro),
    prenda('Pantalón archivado', 'Pantalones', { ...neutro, archivada: true }),
    prenda('Pantalón deseado', 'Pantalones', { ...neutro, deseada: true }),
    prenda('Pantalón para donar', 'Pantalones', { ...neutro, salida: 'donar' }),
  ]
  const huecos = huecosDelArmario(armario)
  assert.equal(huecos[0].ganancia, 2)
  assert.ok(huecos.every((h) => h.ganancia <= 2))
})

test('no propone un color que ya se tiene en ese hueco', () => {
  const armario = []
  for (let i = 0; i < 5; i++) armario.push(prenda(`Camiseta ${i}`, 'Camisetas', neutro), prenda(`Pantalón ${i}`, 'Pantalones', neutro))
  armario.push(prenda('Zapatillas blancas', 'Zapatillas', { colores: ['#f3f3f1'], familia_color: 'neutro' }))
  const huecos = huecosDelArmario(armario)
  assert.ok(!huecos.some((h) => h.hueco === 'pies' && h.color === 'blanco'))
})

test('la armonía de color descarta los básicos que chocan con el armario', () => {
  const verde = { colores: ['#3f6b4f'], familia_color: 'frío' }
  const huecos = huecosDelArmario([
    prenda('Camiseta verde', 'Camisetas', verde),
    prenda('Pantalón verde', 'Pantalones', verde),
  ])
  assert.deepEqual(huecos.map((h) => h.color), ['blanco', 'negro', 'gris'])
})

test('sin datos suficientes no devuelve nada', () => {
  assert.deepEqual(huecosDelArmario([]), [])
  assert.deepEqual(huecosDelArmario([prenda('Camiseta', 'Camisetas', neutro)]), [])
  assert.deepEqual(huecosDelArmario([prenda('Archivada', 'Camisetas', { ...neutro, archivada: true })]), [])
})
