import test from 'node:test'
import assert from 'node:assert/strict'
import { claveCombinacion } from '../src/lib/outfits.js'
import { sugerirOutfits } from '../src/lib/sugerir.js'
import {
  cargarValoraciones,
  claveDeOutfit,
  conValoracion,
  guardarValoracion,
  siguienteValor,
} from '../src/lib/valoraciones.js'

/** ClienteSupabase mínimo: solo lo que usan las valoraciones. */
function falso({ data = [], error = null } = {}) {
  const llamadas = []
  return {
    llamadas,
    cliente: {
      from(tabla) {
        return {
          select: async (columnas) => {
            llamadas.push({ tipo: 'select', tabla, columnas })
            return { data, error }
          },
          upsert: async (filas, opciones) => {
            llamadas.push({ tipo: 'upsert', tabla, filas, opciones })
            return { error }
          },
          delete: () => ({
            eq: async (columna, valor) => {
              llamadas.push({ tipo: 'delete', tabla, columna, valor })
              return { error }
            },
          }),
        }
      },
    },
  }
}

const prenda = (id, nombre, categoria) => ({
  id,
  nombre,
  categorias: { nombre: categoria, tipos: { nombre: 'Ropa' } },
  usos: [],
})

test('la clave de un outfit no depende del orden ni del tipo del id', () => {
  assert.equal(claveDeOutfit(['b', 'a']), claveDeOutfit(['a', 'b']))
  assert.equal(claveDeOutfit(['2', 1]), claveCombinacion([1, '2']))
})

test('tocar otra vez el mismo botón quita la valoración', () => {
  assert.equal(siguienteValor(0, 1), 1)
  assert.equal(siguienteValor(1, 1), 0)
  assert.equal(siguienteValor(-1, 1), 1)

  const mapa = new Map([['x', 1]])
  const quitada = conValoracion(mapa, 'x', 0)
  assert.equal(quitada.has('x'), false)
  assert.equal(mapa.has('x'), true, 'no debe mutar el mapa original')
  assert.equal(conValoracion(mapa, 'y', -1).get('y'), -1)
})

test('carga el mapa y, si la consulta falla, devuelve uno vacío sin lanzar', async () => {
  const ok = falso({ data: [{ clave: 'a', valor: 1 }, { clave: 'b', valor: -1 }] })
  const mapa = await cargarValoraciones(ok.cliente)
  assert.equal(mapa.get('a'), 1)
  assert.equal(mapa.get('b'), -1)

  const roto = falso({ error: { message: 'sin permisos' } })
  assert.equal((await cargarValoraciones(roto.cliente)).size, 0)
  assert.equal((await cargarValoraciones(null)).size, 0)
})

test('guarda y borra; si falla, lo dice sin tolerar tablas ausentes', async () => {
  const ok = falso()
  assert.deepEqual(await guardarValoracion(ok.cliente, 'a', 1), { ok: true })
  assert.deepEqual(ok.llamadas[0], {
    tipo: 'upsert', tabla: 'valoraciones', filas: { clave: 'a', valor: 1 }, opciones: { onConflict: 'user_id,clave' },
  })

  assert.deepEqual(await guardarValoracion(ok.cliente, 'a', 0), { ok: true })
  assert.deepEqual(ok.llamadas[1], { tipo: 'delete', tabla: 'valoraciones', columna: 'clave', valor: 'a' })

  const roto = falso({ error: { code: '23505' } })
  assert.deepEqual(await guardarValoracion(roto.cliente, 'a', 1), { ok: false })
  assert.deepEqual(await guardarValoracion(falso({ error: { code: '42P01' } }).cliente, 'a', 1), { ok: false })
})

test('un «no me gusta» la saca de las propuestas y un «me gusta» la sube', () => {
  const hoy = '2026-11-26'
  const clima = { temp: 20, lluvia: false }
  const armario = [
    prenda('a', 'Camiseta A', 'Camisetas'),
    prenda('b', 'Camiseta B', 'Camisetas'),
    prenda('p', 'Pantalón', 'Pantalones'),
    prenda('z', 'Zapatillas', 'Zapatillas'),
  ]

  const [primera] = sugerirOutfits(armario, { clima, hoy, n: 1 })
  assert.equal(primera.piezas.torso.id, 'a')

  const noGusta = new Map([[claveDeOutfit(primera.ids), -1]])
  const [siguiente] = sugerirOutfits(armario, { clima, hoy, n: 1, valoraciones: noGusta })
  assert.equal(siguiente.piezas.torso.id, 'b')

  const meGusta = new Map([[claveDeOutfit(siguiente.ids), 1]])
  const [favorita] = sugerirOutfits(armario, { clima, hoy, n: 1, valoraciones: meGusta })
  assert.equal(favorita.piezas.torso.id, 'b')
})
