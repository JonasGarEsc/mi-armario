import test from 'node:test'
import assert from 'node:assert/strict'
import { fotoSinUso } from '../src/lib/urlFoto.js'
import { leerTabla } from '../src/lib/backup.js'
import { borrarSoloCache } from '../src/lib/cache.js'

const conteo = (respuesta) => ({ from: () => ({ select: () => ({ eq: async () => respuesta }) }) })

test('la foto solo se borra si consta que nadie la usa', async () => {
  assert.equal(await fotoSinUso(conteo({ count: 0, error: null }), 'u'), true)
  assert.equal(await fotoSinUso(conteo({ count: 1, error: null }), 'u'), false)
  assert.equal(await fotoSinUso(conteo({ count: null, error: { message: 'sin red' } }), 'u'), false)
})

test('la copia trae todas las filas aunque el servidor corte las respuestas', async () => {
  const todas = Array.from({ length: 1203 }, (_, id) => ({ id }))
  const consulta = { select: () => consulta, order: () => consulta, range: async (desde) => ({ data: todas.slice(desde, desde + 500), error: null }) }
  const { data } = await leerTabla({ from: () => consulta }, 'usos')
  assert.deepEqual(data, todas)
})

test('recuperarse de un fallo conserva sesión, cola y listas de maleta', () => {
  const almacen = { removeItem(k) { delete this[k] } }
  const conservar = ['sb-x-auth-token', 'tema_armario', 'armario_v2_u1:cola_offline', 'armario_v2_u1:checklist_m1', 'armario_v2_u1:extras_m1', 'armario_v2_u1:checklistdb_m1']
  const borrar = ['armario_v2_u1:prendas', 'armario_v2_u1:semana_s1', 'armario_v2_u1:conjuntos_m1', 'armario_firma_v3_x@480', 'armario_caja_v3_x']
  for (const k of [...conservar, ...borrar]) almacen[k] = '1'
  Object.defineProperty(almacen, 'removeItem', { enumerable: false })
  borrarSoloCache(almacen)
  assert.deepEqual(Object.keys(almacen).sort(), conservar.sort())
})
