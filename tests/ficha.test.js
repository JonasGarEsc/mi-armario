import test from 'node:test'
import assert from 'node:assert/strict'
import {
  consultarOutfitsDePrenda, etiquetasDePrenda, resumenFicha, textoUsos,
} from '../src/lib/ficha.js'

const conUsos = { precio: 30, usos: [{ fecha: '2026-11-01' }, { fecha: '2026-11-20' }] }

test('la ficha resume usos, último uso y coste por uso', () => {
  const r = resumenFicha(conUsos)
  assert.equal(r.usos, 2)
  assert.equal(r.ultima, '2026-11-20')
  assert.equal(r.precio, 30)
  assert.equal(r.coste, 15)
  assert.equal(r.sinEstrenar, false)
})

test('sin precio no se enseña ni precio ni coste', () => {
  const r = resumenFicha({ usos: [{ fecha: '2026-11-20' }] })
  assert.equal(r.precio, null)
  assert.equal(r.coste, null)
})

test('con precio y cero usos el coste queda sin estrenar', () => {
  const r = resumenFicha({ precio: 40, usos: [] })
  assert.equal(r.precio, 40)
  assert.equal(r.coste, null)
  assert.equal(r.sinEstrenar, true)
  assert.equal(textoUsos(0), 'Sin estrenar')
  assert.equal(textoUsos(1), '1 vez')
  assert.equal(textoUsos(7), '7 veces')
})

test('las etiquetas salen legibles, sin repetir y sin huecos', () => {
  const etiquetas = etiquetasDePrenda({
    categorias: { nombre: 'Camisetas', tipos: { nombre: 'Camisetas' } },
    familia_color: 'negro',
    temporada: ['verano', 'invierno'],
    abrigo: 2,
    formalidad: 5,
    largo: 'crop',
    estampado: 'liso',
    salida: 'donar',
  })
  assert.deepEqual(etiquetas, [
    'Camisetas', 'Negro', 'Verano', 'Invierno', 'Ligera', 'Gala', 'Crop', 'Liso', 'Para donar',
  ])
  assert.deepEqual(etiquetasDePrenda({}), [])
})

function crearSupabase(respuestas) {
  const consultas = []
  return {
    consultas,
    from(tabla) {
      const consulta = {
        select(columnas) {
          consultas.push({ tabla, columnas })
          return consulta
        },
        eq() {
          return Promise.resolve(respuestas.shift() ?? { data: null })
        },
      }
      return consulta
    },
  }
}

test('los outfits que contienen la prenda no se repiten', async () => {
  const supabase = crearSupabase([{
    data: [
      { conjuntos: { id: 'a', nombre: 'Uno' } },
      { conjuntos: { id: 'a', nombre: 'Uno' } },
      { conjuntos: { id: 'b', nombre: 'Dos' } },
      { conjuntos: null },
    ],
  }])
  const lista = await consultarOutfitsDePrenda(supabase, 'prenda-1')
  assert.deepEqual(lista, [{ id: 'a', nombre: 'Uno' }, { id: 'b', nombre: 'Dos' }])
})

test('si falla la consulta de outfits, se informa y no se reintenta', async () => {
  const supabase = crearSupabase([{ data: null, error: { message: 'permiso denegado' } }])
  await assert.rejects(() => consultarOutfitsDePrenda(supabase, 'prenda-1'), /outfits/)
  assert.equal(supabase.consultas.length, 1)
})

test('sin cliente o sin prenda no se consulta nada', async () => {
  assert.deepEqual(await consultarOutfitsDePrenda(null, 'x'), [])
  assert.deepEqual(await consultarOutfitsDePrenda({}, ''), [])
})
