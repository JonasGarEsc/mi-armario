import test from 'node:test'
import assert from 'node:assert/strict'
import { diasSinUsar, estaOlvidada, filtrarPrendas, hayFiltros, sinFiltros, ultimaVez } from '../src/lib/filtros.js'

const hoy = '2026-11-26'
const prendas = [
  { id: 1, nombre: 'Camiseta negra', categoria_id: 'c1', familia_color: 'neutro', temporada: ['verano'], formalidad: 1, usos: [{ fecha: '2026-11-20' }], creado_en: '2026-01-01T10:00:00Z' },
  { id: 2, nombre: 'Jersey de lana', categoria_id: 'c2', familia_color: 'tierra', temporada: ['invierno', 'entretiempo'], formalidad: 3, usos: [{ fecha: '2026-05-01' }, { fecha: '2026-06-10' }], creado_en: '2026-01-01T10:00:00Z' },
  { id: 3, nombre: 'Americana', categoria_id: 'c2', familia_color: 'frío', temporada: ['entretiempo'], formalidad: 4, usos: [], creado_en: '2026-02-01T10:00:00Z' },
  { id: 4, nombre: 'Vestido nuevo', categoria_id: 'c3', familia_color: 'vivo', temporada: ['verano'], formalidad: 4, usos: [], creado_en: '2026-11-10T10:00:00Z' },
  { id: 5, nombre: 'Camisa vieja', categoria_id: 'c1', archivada: true, usos: [] },
]
const ids = (lista) => lista.map((p) => p.id)

test('la última vez y los días sin usar salen de los usos', () => {
  assert.equal(ultimaVez(prendas[1]), '2026-06-10')
  assert.equal(diasSinUsar(prendas[0], hoy), 6)
  assert.equal(diasSinUsar(prendas[2], hoy), null)
})

test('olvidada = 90 días o más; una prenda nueva sin usar todavía no lo está', () => {
  assert.equal(estaOlvidada(prendas[0], hoy), false)
  assert.equal(estaOlvidada(prendas[1], hoy), true) // 169 días
  assert.equal(estaOlvidada(prendas[2], hoy), true) // sin usos y de febrero
  assert.equal(estaOlvidada(prendas[3], hoy), false) // sin usos pero de hace 16 días
})

test('las archivadas no salen y sin filtros sale todo lo demás', () => {
  assert.deepEqual(ids(filtrarPrendas(prendas, { hoy })), [1, 2, 3, 4])
})

test('filtra por color, temporada y formalidad', () => {
  assert.deepEqual(ids(filtrarPrendas(prendas, { hoy, filtros: { ...sinFiltros, familia: 'tierra' } })), [2])
  assert.deepEqual(ids(filtrarPrendas(prendas, { hoy, filtros: { ...sinFiltros, temporada: 'entretiempo' } })), [2, 3])
  assert.deepEqual(ids(filtrarPrendas(prendas, { hoy, filtros: { ...sinFiltros, formalidad: 'elegante' } })), [3, 4])
  assert.deepEqual(ids(filtrarPrendas(prendas, { hoy, filtros: { ...sinFiltros, formalidad: 'casual' } })), [1])
})

test('sin usar en 90 días, y los filtros se combinan con búsqueda y categoría', () => {
  assert.deepEqual(ids(filtrarPrendas(prendas, { hoy, filtros: { ...sinFiltros, olvidadas: true } })), [2, 3])
  assert.deepEqual(ids(filtrarPrendas(prendas, { hoy, busqueda: 'jersey', filtros: { ...sinFiltros, olvidadas: true } })), [2])
  assert.deepEqual(ids(filtrarPrendas(prendas, { hoy, categoriaId: 'c2' })), [2, 3])
})

test('hayFiltros distingue el estado vacío', () => {
  assert.equal(hayFiltros(sinFiltros), false)
  assert.equal(hayFiltros({ ...sinFiltros, olvidadas: true }), true)
})
