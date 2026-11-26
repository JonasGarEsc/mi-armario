import test from 'node:test'
import assert from 'node:assert/strict'
import {
  camposSinPisar, etiquetasCambiadas, etiquetasParaGuardar, hayEtiquetas, normalizarEtiquetas, normalizarSugerencia,
} from '../src/lib/etiquetas.js'

test('de lo que dice la IA solo se aceptan valores permitidos', () => {
  const n = normalizarEtiquetas({
    temporada: ['Invierno', 'Otoño', 'entretiempo'],
    abrigo: 4.4, formalidad: 9, largo: 'Tobillero', estampado: 'Rayas',
    familia_color: 'Neutro', colores: ['#AABBCC', 'rojo', '#12345'], precio: '29,95', inventado: 'x',
  })
  assert.deepEqual(n, {
    temporada: ['invierno', 'entretiempo'], abrigo: 4, largo: 'tobillero', estampado: 'rayas',
    familia_color: 'neutro', colores: ['#aabbcc'], precio: 29.95,
  })
})

test('la entrada rara no rompe nada', () => {
  assert.deepEqual(normalizarEtiquetas(null), {})
  assert.deepEqual(normalizarEtiquetas('hola'), {})
  assert.deepEqual(normalizarEtiquetas({ abrigo: 'mucho', precio: -3, temporada: 7 }), {})
})

test('la sugerencia recorta el nombre y separa la clasificación', () => {
  const s = normalizarSugerencia({ nombre: '  Camiseta   negra ', tipo: 'Ropa', categoria: 'Camisetas', largo: 'cadera' })
  assert.equal(s.nombre, 'Camiseta negra')
  assert.equal(s.tipo, 'Ropa')
  assert.deepEqual(s.etiquetas, { largo: 'cadera' })
  assert.equal(normalizarSugerencia(undefined), null)
})

test('no se pisa lo que ya tiene la prenda ni lo editado a mano', () => {
  const sugeridas = { largo: 'cadera', abrigo: 2, temporada: ['verano'] }
  assert.deepEqual(camposSinPisar({ largo: 'crop' }, sugeridas), { abrigo: 2, temporada: ['verano'] })
  assert.deepEqual(camposSinPisar({ temporada: [] }, sugeridas), { largo: 'cadera', abrigo: 2, temporada: ['verano'] })
  assert.deepEqual(camposSinPisar({ etiquetas_auto: false }, sugeridas), {})
})

test('detecta si las etiquetas han cambiado', () => {
  assert.equal(etiquetasCambiadas({ largo: 'crop' }, { largo: 'crop' }), false)
  assert.equal(etiquetasCambiadas({ largo: null }, { largo: '' }), false)
  assert.equal(etiquetasCambiadas({ colores: ['#000000'] }, { colores: ['#000000', '#ffffff'] }), true)
  assert.equal(etiquetasCambiadas({}, { abrigo: 3 }), true)
})

test('del formulario a la base de datos, lo vacío es null', () => {
  const fila = etiquetasParaGuardar({ colores: [], largo: '', abrigo: '3', precio: '12,5', temporada: [] })
  assert.equal(fila.largo, null)
  assert.equal(fila.colores, null)
  assert.equal(fila.abrigo, 3)
  assert.equal(fila.precio, 12.5)
  assert.equal(hayEtiquetas(fila), true)
  assert.equal(hayEtiquetas({ colores: [], largo: '' }), false)
})
