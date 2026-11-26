import test from 'node:test'
import assert from 'node:assert/strict'
import {
  filasDeValoraciones,
  importarValoraciones,
  leerTabla,
  remapearValoraciones,
  normalizarCopia,
} from '../src/lib/backup.js'

test('la copia incluye las valoraciones y las deja vacías si no venían', () => {
  const conValoraciones = normalizarCopia({
    prendas: [],
    conjuntos: [],
    valoraciones: [{ clave: 'a', valor: 1 }],
  })
  assert.deepEqual(conValoraciones.valoraciones, [{ clave: 'a', valor: 1 }])
  assert.deepEqual(normalizarCopia({ prendas: [], conjuntos: [] }).valoraciones, [])
})

test('las valoraciones inválidas se descartan y no se repiten', () => {
  const filas = filasDeValoraciones([
    { clave: ' a ', valor: 1 },
    { clave: 'a', valor: -1 },
    { clave: '', valor: 1 },
    { clave: 'b', valor: 2 },
    { clave: 'c', valor: -1 },
    { clave: 'x'.repeat(501), valor: 1 },
  ])
  assert.deepEqual(filas, [{ clave: 'a', valor: -1 }, { clave: 'c', valor: -1 }])
})

test('todas las filas de un lote llevan las mismas claves y solo las suyas', async () => {
  const lotes = []
  const supabase = {
    from: () => ({
      upsert: async (filas, opciones) => {
        lotes.push({ filas, opciones })
        return { error: null }
      },
    }),
  }
  const r = await importarValoraciones(supabase, [
    { clave: 'a', valor: 1, user_id: 'otra-cuenta', creado_en: '2026-01-01' },
    { clave: 'b', valor: -1 },
  ])
  assert.deepEqual(r, { guardadas: 2, omitidas: 0 })
  assert.deepEqual(lotes[0].filas, [{ clave: 'a', valor: 1 }, { clave: 'b', valor: -1 }])
  assert.deepEqual(lotes[0].opciones, { onConflict: 'user_id,clave' })
})

test('si falla una valoración, se cuenta como omitida', async () => {
  const roto = { from: () => ({ upsert: async () => ({ error: { code: '23505' } }) }) }
  assert.deepEqual(await importarValoraciones(roto, [{ clave: 'a', valor: 1 }]), { guardadas: 0, omitidas: 1 })
})

test('la copia de valoraciones se lee ordenada por clave, que es su clave primaria', async () => {
  const ordenes = []
  const consulta = {
    select: () => consulta,
    order: (columna) => { ordenes.push(columna); return consulta },
    range: async () => ({ data: [], error: null }),
  }
  const { data } = await leerTabla({ from: () => consulta }, 'valoraciones')
  assert.deepEqual(data, [])
  assert.deepEqual(ordenes, ['clave'])
})

test('las valoraciones restauradas apuntan a las prendas nuevas', () => {
  const mapa = new Map([['a', 'z'], ['b', 'c']])
  assert.deepEqual(
    remapearValoraciones([{ clave: 'a,b', valor: 1 }, { clave: 'a,perdida', valor: -1 }], mapa),
    [{ clave: 'c,z', valor: 1 }],
  )
})
