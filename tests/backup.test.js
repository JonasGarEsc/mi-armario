import test from 'node:test'
import assert from 'node:assert/strict'
import { contarCopia, filaDeMaletaExtra, filaDePrenda, normalizarCopia } from '../src/lib/backup.js'

test('una copia vacía se normaliza con todas las tablas', () => {
  const copia = normalizarCopia({ prendas: [], conjuntos: [] })
  assert.deepEqual(copia.prendas, [])
  assert.deepEqual(copia.semanas, [])
  assert.deepEqual(copia.usos, [])
  assert.deepEqual(copia.maleta_extras, [])
})

test('un archivo cualquiera no pasa por copia', () => {
  assert.throws(() => normalizarCopia({ hola: 'mundo' }), /copia/i)
})

test('el resumen cuenta lo que se va a restaurar', () => {
  const resumen = contarCopia({
    prendas: [{ id: '1' }, { id: '2' }],
    conjuntos: [{ id: '3' }],
    maletas: [],
  })
  assert.equal(resumen.prendas, 2)
  assert.equal(resumen.conjuntos, 1)
  assert.equal(resumen.maletas, 0)
})

test('una copia antigua importa las prendas sin etiquetas', () => {
  const fila = filaDePrenda({ id: 'a', nombre: 'Camiseta', imagen_url: 'x.webp', categoria_id: 'c' }, 'nuevo', 'cat')
  assert.deepEqual(fila, { id: 'nuevo', nombre: 'Camiseta', imagen_url: 'x.webp', categoria_id: 'cat' })
})

test('una copia nueva conserva etiquetas, origen y archivada, y descarta lo inválido', () => {
  const fila = filaDePrenda({
    nombre: 'Americana', imagen_url: 'y.webp', colores: ['#112233'], temporada: ['invierno'], abrigo: 3,
    largo: 'cadera', precio: '89.5', etiquetas_auto: false, archivada: true, formalidad: 12, estampado: 'tartán',
  }, 'n', 'c')
  assert.deepEqual(fila.colores, ['#112233'])
  assert.equal(fila.abrigo, 3)
  assert.equal(fila.precio, 89.5)
  assert.equal(fila.etiquetas_auto, false)
  assert.equal(fila.archivada, true)
  assert.equal('formalidad' in fila, false)
  assert.equal('estampado' in fila, false)
})

test('la lista de la maleta se remapea a la maleta y la prenda nuevas', () => {
  const fila = filaDeMaletaExtra(
    { id: 'viejo', maleta_id: 'm-vieja', prenda_id: 'p-vieja', texto: null, hecho: true },
    'nuevo', 'm-nueva', 'p-nueva',
  )
  assert.deepEqual(fila, { id: 'nuevo', maleta_id: 'm-nueva', texto: null, prenda_id: 'p-nueva', hecho: true })
})

test('las cosas de texto de la maleta se restauran y las rotas se omiten', () => {
  assert.deepEqual(
    filaDeMaletaExtra({ texto: '  Cargador  ' }, 'n', 'm', null),
    { id: 'n', maleta_id: 'm', texto: '  Cargador  ', prenda_id: null, hecho: false },
  )
  assert.equal(filaDeMaletaExtra({ texto: 'Cargador' }, 'n', null, null), null)
  assert.equal(filaDeMaletaExtra({ prenda_id: 'p' }, 'n', 'm', null), null)
})
