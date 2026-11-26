import test from 'node:test'
import assert from 'node:assert/strict'
import { contarPor, costePorUso, dinero, estadisticasArmario, numUsos } from '../src/lib/estadisticas.js'

const hoy = '2026-11-26'
const usos = (n, fecha = '2026-11-20') => Array.from({ length: n }, () => ({ fecha }))
const p = (id, extra = {}) => ({ id, nombre: id, usos: [], creado_en: '2026-01-01T00:00:00Z', categorias: { nombre: 'X', tipos: { nombre: 'Ropa' } }, ...extra })

const armario = [
  p('camiseta', { usos: usos(20), precio: 20, familia_color: 'neutro', temporada: ['verano'] }),
  p('jersey', { usos: usos(2, '2026-02-01'), precio: 100, familia_color: 'tierra', temporada: ['invierno'] }),
  p('abrigo', { usos: [], precio: 200, familia_color: 'neutro', temporada: ['invierno', 'entretiempo'], categorias: { nombre: 'Abrigos', tipos: { nombre: 'Abrigos' } } }),
  p('vestido', { usos: usos(1, '2026-11-01'), familia_color: 'vivo' }),
  p('nueva', { usos: [], creado_en: '2026-11-20T00:00:00Z' }),
  p('archivada', { archivada: true, usos: usos(50), precio: 999 }),
  p('para-donar', { usos: [], salida: 'donar' }),
]

test('cuenta usos y cuesta por uso solo con precio y usos', () => {
  assert.equal(numUsos(armario[0]), 20)
  assert.equal(costePorUso(armario[0]), 1)
  assert.equal(costePorUso(armario[1]), 50)
  assert.equal(costePorUso(armario[2]), null) // precio pero ningún uso
  assert.equal(costePorUso(armario[3]), null) // usos pero sin precio
})

test('las archivadas no cuentan, pero se listan', () => {
  const e = estadisticasArmario(armario, hoy)
  assert.equal(e.total, 6)
  assert.deepEqual(e.archivadas.map((x) => x.id), ['archivada'])
  assert.equal(e.usosTotales, 23)
  assert.ok(!e.masUsadas.some((x) => x.id === 'archivada'))
})

test('más y menos usadas', () => {
  const e = estadisticasArmario(armario, hoy)
  assert.deepEqual(e.masUsadas.map((x) => x.id), ['camiseta', 'jersey', 'vestido'])
  // Las nunca puestas primero; entre ellas, la más antigua antes.
  assert.deepEqual(e.menosUsadas.slice(0, 3).map((x) => x.id), ['abrigo', 'para-donar', 'nueva'])
})

test('mejores y peores compras', () => {
  const e = estadisticasArmario(armario, hoy)
  assert.deepEqual(e.mejores.map((x) => x.id), ['camiseta', 'jersey'])
  assert.deepEqual(e.peores.map((x) => x.id), ['abrigo', 'jersey', 'camiseta']) // el que no se ha puesto, el primero
  assert.equal(e.inversion, 320)
  assert.equal(e.conPrecio, 3)
})

test('olvidadas: 90 días o más, sin las ya marcadas para salir, la que más lleva primero', () => {
  const e = estadisticasArmario(armario, hoy)
  assert.deepEqual(e.olvidadas.map((o) => o.prenda.id), ['abrigo', 'jersey'])
  assert.equal(e.olvidadas[1].dias, 298)
  assert.deepEqual(e.paraSalir.map((x) => x.id), ['para-donar'])
})

test('reparto por color, tipo y temporada', () => {
  const e = estadisticasArmario(armario, hoy)
  assert.deepEqual(e.porColor.slice(0, 2), [{ etiqueta: 'neutro', valor: 2 }, { etiqueta: 'Sin indicar', valor: 2 }])
  assert.equal(e.porTipo.find((x) => x.etiqueta === 'Abrigos').valor, 1)
  // Una prenda de dos temporadas cuenta en las dos.
  assert.equal(e.porTemporada.find((x) => x.etiqueta === 'invierno').valor, 2)
  assert.equal(e.porTemporada.find((x) => x.etiqueta === 'entretiempo').valor, 1)
  assert.deepEqual(contarPor([], () => []), [])
})

test('el dinero va en euros con coma', () => {
  assert.equal(dinero(12.5), '12,50 €')
  assert.equal(dinero(20), '20 €')
  assert.match(dinero(1234.5), /1\.?234,50 €/)
})
