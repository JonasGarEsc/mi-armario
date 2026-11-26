import test from 'node:test'
import assert from 'node:assert/strict'
import {
  crearDatosDemo, parseSelect, aplicarSelect, aplicarConsulta, insertarFilas, borrarFilas, relacion,
} from '../e2e/supabase-falso.js'
import { climaFalso } from '../e2e/clima-falso.js'
import { crearPngPrenda } from '../e2e/png.js'

test('el select anidado se parte solo por las comas de fuera', () => {
  const arbol = parseSelect('*, categorias(nombre, tipos(id, nombre)), usos(fecha)')
  assert.deepEqual(arbol.map((n) => n.nombre), ['*', 'categorias', 'usos'])
  assert.deepEqual(arbol[1].hijos.map((n) => n.nombre), ['nombre', 'tipos'])
  assert.deepEqual(arbol[1].hijos[1].hijos.map((n) => n.nombre), ['id', 'nombre'])
})

test('las relaciones se resuelven en los dos sentidos', () => {
  assert.equal(relacion('prendas', 'categorias').tipo, 'objeto')
  assert.equal(relacion('prendas', 'categorias').clave, 'categoria_id')
  assert.equal(relacion('categorias', 'prendas').tipo, 'lista')
  assert.equal(relacion('conjunto_prenda', 'conjuntos').tipo, 'objeto')
  assert.equal(relacion('conjuntos', 'conjunto_prenda').tipo, 'lista')
  assert.equal(relacion('prendas', 'desconocida'), null)
})

test('el select incrusta objetos y listas con sus hijos', () => {
  const datos = {
    tipos: [{ id: 't1', nombre: 'Arriba' }],
    categorias: [{ id: 'c1', nombre: 'Camisetas', tipo_id: 't1' }],
    prendas: [{ id: 'p1', nombre: 'Camiseta', categoria_id: 'c1' }],
    usos: [{ id: 'u1', prenda_id: 'p1', fecha: '2026-01-01' }, { id: 'u2', prenda_id: 'p1', fecha: '2026-01-02' }],
  }
  const [fila] = aplicarSelect(datos.prendas, '*, categorias(nombre, tipos(id, nombre)), usos(fecha)', datos, 'prendas')
  assert.equal(fila.nombre, 'Camiseta')
  assert.deepEqual(fila.categorias, { nombre: 'Camisetas', tipos: { id: 't1', nombre: 'Arriba' } })
  assert.deepEqual(fila.usos, [{ fecha: '2026-01-01' }, { fecha: '2026-01-02' }])
})

test('los filtros eq, in, is y not se combinan con orden y tramo', () => {
  const filas = [
    { id: '1', nombre: 'A', maleta_id: 'm1', fecha: '2026-01-03' },
    { id: '2', nombre: 'B', maleta_id: 'm2', fecha: '2026-01-01' },
    { id: '3', nombre: 'C', maleta_id: null, fecha: '2026-01-02' },
  ]
  const params = new URLSearchParams('maleta_id=in.(m1,m2)&order=fecha.desc&offset=0&limit=1')
  const salida = aplicarConsulta(filas, params)
  assert.deepEqual(salida.map((f) => f.id), ['1'])

  const sinSemana = aplicarConsulta(filas, new URLSearchParams('maleta_id=not.is.null'))
  assert.equal(sinSemana.length, 2)

  const nulas = aplicarConsulta(filas, new URLSearchParams('maleta_id=is.null'))
  assert.deepEqual(nulas.map((f) => f.id), ['3'])
})

test('insertar guarda la fila y las piezas anidadas; borrar arrastra la cascada', () => {
  const { datos } = crearDatosDemo()
  const creados = insertarFilas(datos, 'conjuntos', [{
    nombre: 'Nuevo', maleta_id: 'm-paris', fecha: '2026-05-01',
    conjunto_prenda: [{ prenda_id: 'p-camiseta' }, { prenda_id: 'p-vaqueros' }],
  }])
  assert.equal(creados.length, 1)
  assert.equal(datos.conjunto_prenda.filter((cp) => cp.conjunto_id === creados[0].id).length, 2)

  const prenda = datos.prendas.find((p) => p.id === 'p-camiseta')
  borrarFilas(datos, 'prendas', [prenda])
  assert.equal(datos.prendas.some((p) => p.id === 'p-camiseta'), false)
  assert.equal(datos.conjunto_prenda.some((cp) => cp.prenda_id === 'p-camiseta'), false)
  assert.equal(datos.usos.some((u) => u.prenda_id === 'p-camiseta'), false)
})

test('el upsert respeta la clave compuesta y no duplica', () => {
  const { datos } = crearDatosDemo()
  const params = new URLSearchParams('on_conflict=user_id,clave')
  insertarFilas(datos, 'valoraciones', [{ clave: 'a|b', valor: 1 }], params)
  insertarFilas(datos, 'valoraciones', [{ clave: 'a|b', valor: -1 }], params)
  assert.equal(datos.valoraciones.length, 1)
  assert.equal(datos.valoraciones[0].valor, -1)
})

test('la foto de prueba es un PNG RGBA válido', () => {
  const png = crearPngPrenda([10, 20, 30], 24, 30)
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  assert.equal(png.subarray(12, 16).toString('ascii'), 'IHDR')
  assert.equal(png.readUInt32BE(16), 24)
  assert.equal(png.readUInt32BE(20), 30)
  assert.equal(png[25], 6) // RGBA
  assert.equal(png.subarray(-8, -4).toString('ascii'), 'IEND')
})

test('el clima falso devuelve un día por cada fecha pedida', () => {
  const prevision = climaFalso('https://api.open-meteo.com/v1/forecast?start_date=2026-05-01&end_date=2026-05-03')
  assert.deepEqual(prevision.daily.time, ['2026-05-01', '2026-05-02', '2026-05-03'])
  assert.equal(prevision.daily.apparent_temperature_max.length, 3)
  const geo = climaFalso('https://geocoding-api.open-meteo.com/v1/search?name=Par%C3%ADs&count=1')
  assert.equal(geo.results[0].name, 'París')
})
