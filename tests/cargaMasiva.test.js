import test from 'node:test'
import assert from 'node:assert/strict'
import { crearCargaMasiva, nombreDesdeArchivo, resumenCarga } from '../src/lib/cargaMasiva.js'
import { clasificarSugerencia } from '../src/lib/etiquetas.js'

const foto = (n) => ({ name: n })
const espera = (ms = 5) => new Promise((r) => setTimeout(r, ms))
const pasosOk = (registro = []) => ({
  preparar: async (a, { onEstado }) => { onEstado('Recortando'); registro.push(`prep:${a.name}`); await espera(); return { blob: a.name } },
  analizar: async (f) => ({ color: { colores: ['#111111'] }, sugerencia: { nombre: `Prenda ${f.blob}` } }),
  vistaPrevia: (f) => `url:${f.blob}`,
  liberar: (u) => registro.push(`lib:${u}`),
})
const hastaQueAcabe = async (cola) => { while (resumenCarga(cola.obtener()).activas > 0) await espera() }

test('nombres a partir del archivo', () => {
  assert.equal(nombreDesdeArchivo('IMG_2041.jpg'), 'IMG 2041')
  assert.equal(nombreDesdeArchivo('camiseta-negra.final.png'), 'camiseta negra.final')
  assert.equal(nombreDesdeArchivo(null), '')
})

test('procesa las fotos de una en una y las deja listas', async () => {
  const registro = []
  const cola = crearCargaMasiva({ pasos: pasosOk(registro) })
  cola.encolar([foto('a.jpg'), foto('b.jpg'), foto('c.jpg')])
  await hastaQueAcabe(cola)
  assert.deepEqual(registro, ['prep:a.jpg', 'prep:b.jpg', 'prep:c.jpg'])
  const items = cola.obtener()
  assert.deepEqual(items.map((i) => i.estado), ['lista', 'lista', 'lista'])
  assert.equal(items[0].nombre, 'Prenda a.jpg')
  assert.equal(items[0].vistaPrevia, 'url:a.jpg')
  assert.deepEqual(resumenCarga(items), { total: 3, activas: 0, listas: 3, errores: 0, terminadas: 3 })
})

test('mientras trabaja, los estados van de cola a preparando', async () => {
  const vistos = []
  const cola = crearCargaMasiva({ pasos: pasosOk() })
  cola.suscribir(() => vistos.push(cola.obtener().map((i) => i.estado).join()))
  cola.encolar([foto('a.jpg'), foto('b.jpg')])
  await hastaQueAcabe(cola)
  assert.ok(vistos.some((v) => v === 'preparando,cola'))
  assert.ok(vistos.some((v) => v === 'lista,preparando'))
  assert.equal(vistos.at(-1), 'lista,lista')
})

test('un error no para la cola y se puede reintentar', async () => {
  let fallar = true
  const pasos = { ...pasosOk(), preparar: async (a) => { if (a.name === 'mala.jpg' && fallar) throw new Error('Foto rota'); return { blob: a.name } } }
  const cola = crearCargaMasiva({ pasos })
  cola.encolar([foto('mala.jpg'), foto('buena.jpg')])
  await hastaQueAcabe(cola)
  assert.deepEqual(cola.obtener().map((i) => i.estado), ['error', 'lista'])
  assert.equal(cola.obtener()[0].mensaje, 'Foto rota')

  fallar = false
  cola.reintentar(cola.obtener()[0].id)
  await hastaQueAcabe(cola)
  assert.deepEqual(cola.obtener().map((i) => i.estado), ['lista', 'lista'])
})

test('sin sugerencia, el nombre sale del archivo', async () => {
  const pasos = { ...pasosOk(), analizar: async () => ({ color: null, sugerencia: null }) }
  const cola = crearCargaMasiva({ pasos })
  cola.encolar([foto('IMG_77.jpg')])
  await hastaQueAcabe(cola)
  assert.equal(cola.obtener()[0].nombre, 'IMG 77')
})

test('se pueden añadir más fotos mientras trabaja y descartar una libera su vista previa', async () => {
  const registro = []
  const cola = crearCargaMasiva({ pasos: pasosOk(registro) })
  cola.encolar([foto('a.jpg')])
  cola.encolar([foto('b.jpg')])
  await hastaQueAcabe(cola)
  assert.equal(cola.obtener().length, 2)
  cola.descartar(cola.obtener()[0].id)
  assert.equal(cola.obtener().length, 1)
  assert.ok(registro.includes('lib:url:a.jpg'))
})

test('descartar una foto en marcha no la deja volver ni rompe la cola', async () => {
  const cola = crearCargaMasiva({ pasos: pasosOk() })
  const [primera] = cola.encolar([foto('a.jpg'), foto('b.jpg')])
  cola.descartar(primera)
  await hastaQueAcabe(cola)
  assert.deepEqual(cola.obtener().map((i) => i.archivo.name), ['b.jpg'])
})

test('editar cambia lo que el usuario revisa', async () => {
  const cola = crearCargaMasiva({ pasos: pasosOk() })
  const [id] = cola.encolar([foto('a.jpg')])
  await hastaQueAcabe(cola)
  cola.editar(id, { nombre: 'Mi camiseta', categoriaId: 'c1' })
  assert.equal(cola.obtener()[0].nombre, 'Mi camiseta')
  assert.equal(cola.obtener()[0].categoriaId, 'c1')
})

test('encajar lo que sugiere la IA con tus tipos y categorías', () => {
  const tipos = [{ id: 't1', nombre: 'Ropa' }]
  const categorias = [{ id: 'c1', nombre: 'Camisetas', tipo_id: 't1' }, { id: 'c2', nombre: 'Camisetas', tipo_id: 't9' }]
  assert.deepEqual(clasificarSugerencia({ tipo: 'ropa', categoria: 'CAMISETAS' }, tipos, categorias), { tipoId: 't1', categoriaId: 'c1', pista: '' })
  const casi = clasificarSugerencia({ tipo: 'Ropa', categoria: 'Chaquetas' }, tipos, categorias)
  assert.equal(casi.tipoId, 't1')
  assert.equal(casi.categoriaId, '')
  assert.match(casi.pista, /Chaquetas/)
  assert.match(clasificarSugerencia({ tipo: 'Calzado', categoria: 'Botas' }, tipos, categorias).pista, /Calzado/)
  assert.deepEqual(clasificarSugerencia(null, tipos, categorias), { tipoId: '', categoriaId: '', pista: '' })
})
