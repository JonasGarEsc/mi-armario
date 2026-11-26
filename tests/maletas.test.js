import test from 'node:test'
import assert from 'node:assert/strict'
import { cacheMaletas, composicionMaleta, extraerImagenesMaleta, resumenMaleta } from '../src/lib/maletas.js'

test('las fotos se reparten en una o dos columnas según cuántas haya', () => {
  assert.deepEqual([1, 2].map(n => composicionMaleta(Array(n).fill('x')).columnas), [1, 1])
  assert.deepEqual([3, 4, 5, 8].map(n => composicionMaleta(Array(n).fill('x')).columnas), [2, 2, 2, 2])
})

test('con muchas fotos las filas se ordenan y se solapan menos', () => {
  const cuatro = composicionMaleta(['a', 'b', 'c', 'd'])
  assert.deepEqual(cuatro, { columnas: 2, filas: 2, llena: false, ancho: 62, alto: 64 })

  const cinco = composicionMaleta(['a', 'b', 'c', 'd', 'e'])
  assert.equal(cinco.filas, 3)
  assert.equal(cinco.llena, true)
  assert.equal(cinco.ancho, 52)
  assert.ok(Math.abs(cinco.alto - (100 / 3 + 3)) < 1e-9)
})

test('la miniatura de la maleta lee el resumen de la caché', () => {
  assert.deepEqual(
    extraerImagenesMaleta({ imagenes: ['a', 'b'], outfits: 3 }),
    { imagenes: ['a', 'b'], total: 3 },
  )
  assert.deepEqual(extraerImagenesMaleta({}), { imagenes: [], total: 0 })
})

test('la miniatura recorre el árbol, quita repetidas y se queda con ocho', () => {
  const urls = Array.from({ length: 10 }, (_, i) => `foto-${i}`)
  const maleta = {
    conjuntos: [{
      conjunto_prenda: [
        { prendas: { imagen_url: 'a' } },
        { prendas: { imagen_url: 'b' } },
        { prendas: null },
        { prendas: { imagen_url: 'a' } },
      ],
    }],
  }
  assert.deepEqual(extraerImagenesMaleta(maleta), { imagenes: ['a', 'b'], total: 2 })
  assert.deepEqual(
    extraerImagenesMaleta({ conjuntos: [{ conjunto_prenda: urls.map(url => ({ prendas: { imagen_url: url } })) }] }),
    { imagenes: urls.slice(0, 8), total: 10 },
  )
})

test('el resumen de la caché conserva las fechas y cuenta los outfits', () => {
  const resumen = resumenMaleta({
    id: 'm1',
    nombre: 'París',
    conjuntos: [
      { conjunto_prenda: [{ prendas: { imagen_url: 'a' } }, { prendas: { imagen_url: 'b' } }] },
      { conjunto_prenda: [{ prendas: { imagen_url: 'a' } }] },
    ],
  })
  assert.deepEqual(resumen, {
    id: 'm1',
    nombre: 'París',
    destino: null,
    fecha_inicio: null,
    fecha_fin: null,
    outfits: 2,
    imagenes: ['a', 'b'],
  })
})

test('la caché no vuelve a resumir una maleta que ya era un resumen', () => {
  const resumen = { id: 'm1', nombre: 'París', imagenes: ['a'], outfits: 1 }
  assert.deepEqual(cacheMaletas([resumen]), [resumen])
})
