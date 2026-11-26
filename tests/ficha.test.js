import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CONSULTA_OUTFITS_BASICA, consultarOutfitsDePrenda, etiquetasDePrenda, resumenFicha, textoUsos,
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

test('con una base antigua se reintenta la consulta básica', async () => {
  const supabase = crearSupabase([{ data: null }, { data: [{ conjuntos: { id: 'a', nombre: 'Uno' } }] }])
  const lista = await consultarOutfitsDePrenda(supabase, 'prenda-1')
  assert.equal(lista.length, 1)
  assert.equal(supabase.consultas.length, 2)
  assert.equal(supabase.consultas[1].columnas, CONSULTA_OUTFITS_BASICA)
})

test('sin cliente o sin prenda no se consulta nada', async () => {
  assert.deepEqual(await consultarOutfitsDePrenda(null, 'x'), [])
  assert.deepEqual(await consultarOutfitsDePrenda({}, ''), [])
})
