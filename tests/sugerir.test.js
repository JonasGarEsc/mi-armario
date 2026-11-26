import test from 'node:test'
import assert from 'node:assert/strict'
import { armonia, huecoDe, nivelAbrigoObjetivo, sonDistintos, sugerirOutfits, temporadaDeTemperatura } from '../src/lib/sugerir.js'

const hoy = '2026-11-26'
let contador = 0
function prenda(nombre, categoria, extra = {}) {
  contador++
  return { id: `p${contador}`, nombre, categorias: { nombre: categoria, tipos: { nombre: 'Ropa' } }, usos: [], creado_en: '2026-01-01T00:00:00Z', ...extra }
}
const camiseta = (n, e) => prenda(n, 'Camisetas', e)
const pantalon = (n, e) => prenda(n, 'Pantalones', e)
const zapatos = (n, e) => prenda(n, 'Zapatillas', e)
const chaqueta = (n, e) => prenda(n, 'Abrigos', e)
const rojo = { colores: ['#d01c1c'], familia_color: 'vivo' }
const azulVivo = { colores: ['#1c4fd0'], familia_color: 'vivo' }
const negro = { colores: ['#111111'], familia_color: 'neutro' }

test('las prendas se reparten por hueco del cuerpo', () => {
  assert.equal(huecoDe(camiseta('x')), 'torso')
  assert.equal(huecoDe(pantalon('x')), 'piernas')
  assert.equal(huecoDe(zapatos('x')), 'pies')
  assert.equal(huecoDe(prenda('Vestido rojo', 'Vestidos')), 'vestido')
})

test('temperatura → temporada y nivel de abrigo', () => {
  assert.equal(temporadaDeTemperatura(30), 'verano')
  assert.equal(temporadaDeTemperatura(5), 'invierno')
  assert.equal(temporadaDeTemperatura(17), 'entretiempo')
  assert.ok(nivelAbrigoObjetivo(2) > nivelAbrigoObjetivo(15))
  assert.ok(nivelAbrigoObjetivo(15) > nivelAbrigoObjetivo(30))
})

test('propone un outfit completo: arriba, abajo y calzado', () => {
  const armario = [camiseta('Camiseta'), pantalon('Vaquero'), zapatos('Zapatillas')]
  const [o] = sugerirOutfits(armario, { clima: { temp: 20 }, hoy })
  assert.equal(o.ids.length, 3)
  assert.ok(o.piezas.torso && o.piezas.piernas && o.piezas.pies)
})

test('con frío pide abrigo; con calor, no', () => {
  const armario = [
    camiseta('Camiseta', { abrigo: 1, temporada: ['verano'] }), camiseta('Jersey', { abrigo: 3, temporada: ['invierno'] }),
    pantalon('Vaquero'), zapatos('Botas'),
    chaqueta('Plumífero', { abrigo: 5, temporada: ['invierno'] }),
  ]
  const [frio] = sugerirOutfits(armario, { clima: { temp: 3 }, hoy })
  assert.ok(frio.piezas.abrigo, 'con 3 °C debería llevar abrigo')
  assert.equal(frio.piezas.torso.nombre, 'Jersey')
  const [calor] = sugerirOutfits(armario, { clima: { temp: 31 }, hoy })
  assert.equal(calor.piezas.abrigo, null)
  assert.equal(calor.piezas.torso.nombre, 'Camiseta')
})

test('con lluvia no propone sandalias', () => {
  const armario = [camiseta('Camiseta'), pantalon('Vaquero'), zapatos('Sandalias'), zapatos('Botas de agua')]
  const [o] = sugerirOutfits(armario, { clima: { temp: 20, lluvia: true }, hoy })
  assert.equal(o.piezas.pies.nombre, 'Botas de agua')
})

test('prioriza lo que lleva tiempo sin ponerse y descansa lo usado hace nada', () => {
  const vieja = camiseta('Camiseta vieja', { usos: [{ fecha: '2026-08-01' }] })
  const reciente = camiseta('Camiseta de ayer', { usos: [{ fecha: '2026-11-25' }] })
  const nueva = camiseta('Camiseta de ayer-2', { usos: [{ fecha: '2026-10-20' }] })
  const armario = [reciente, nueva, vieja, pantalon('Vaquero'), zapatos('Zapatillas')]
  const [o] = sugerirOutfits(armario, { clima: { temp: 20 }, hoy })
  assert.equal(o.piezas.torso.nombre, 'Camiseta vieja')
  assert.ok(!o.ids.includes(reciente.id), 'la de ayer descansa')
})

test('armonía: neutro con todo, vivos distintos chocan', () => {
  assert.equal(armonia(rojo, negro), 1)
  assert.ok(armonia(rojo, azulVivo) < 0)
  assert.equal(armonia({}, rojo), 0)
})

test('evita juntar dos colores vivos que chocan', () => {
  const armario = [camiseta('Roja', rojo), pantalon('Azul vivo', azulVivo), pantalon('Negro', negro), zapatos('Zapatillas', negro)]
  const [o] = sugerirOutfits(armario, { clima: { temp: 20 }, hoy })
  assert.equal(o.piezas.piernas.nombre, 'Negro')
})

test('no mezcla dos estampados distintos', () => {
  const armario = [
    camiseta('Rayas', { estampado: 'rayas' }), camiseta('Lisa', { estampado: 'liso' }),
    pantalon('Flores', { estampado: 'flores' }), zapatos('Zapatillas'),
  ]
  const [o] = sugerirOutfits(armario, { clima: { temp: 20 }, hoy })
  assert.equal(o.piezas.torso.nombre, 'Lisa')
})

test('formalidad coherente y ocasión', () => {
  const armario = [
    camiseta('Camisa', { formalidad: 4 }), camiseta('Camiseta técnica', { formalidad: 1 }),
    pantalon('Pantalón de vestir', { formalidad: 4 }), pantalon('Chándal', { formalidad: 1 }), zapatos('Zapatos', { formalidad: 4 }), zapatos('Zapatillas deporte', { formalidad: 1 }),
  ]
  const [trabajo] = sugerirOutfits(armario, { clima: { temp: 20 }, hoy, ocasion: 'cena' })
  assert.equal(trabajo.piezas.torso.nombre, 'Camisa')
  assert.equal(trabajo.piezas.piernas.nombre, 'Pantalón de vestir')
  const [deporte] = sugerirOutfits(armario, { clima: { temp: 20 }, hoy, ocasion: 'deporte' })
  assert.equal(deporte.piezas.torso.nombre, 'Camiseta técnica')
})

test('los outfits propuestos se diferencian en al menos 2 prendas', () => {
  const armario = [
    ...['A', 'B', 'C', 'D'].map((n) => camiseta(`Camiseta ${n}`)),
    ...['A', 'B', 'C', 'D'].map((n) => pantalon(`Pantalón ${n}`)),
    zapatos('Zapatillas'),
  ]
  const outfits = sugerirOutfits(armario, { clima: { temp: 20 }, hoy })
  assert.equal(outfits.length, 3)
  for (let i = 0; i < outfits.length; i++) for (let j = i + 1; j < outfits.length; j++) {
    assert.ok(sonDistintos(outfits[i].ids, outfits[j].ids), 'se parecen demasiado')
  }
})

test('una prenda fijada está en todos los outfits, aunque lleve poco tiempo parada', () => {
  const fija = pantalon('Vaquero favorito', { usos: [{ fecha: '2026-11-25' }] })
  const armario = [fija, pantalon('Otro'), ...['A', 'B', 'C'].map((n) => camiseta(`Camiseta ${n}`)), zapatos('Zapatillas'), zapatos('Botas')]
  const outfits = sugerirOutfits(armario, { clima: { temp: 20 }, hoy, fijadas: [fija.id] })
  assert.ok(outfits.length > 0)
  for (const o of outfits) assert.ok(o.ids.includes(fija.id))
})

test('«otra» no repite lo descartado ni se parece a lo que se queda', () => {
  const armario = [
    ...['A', 'B', 'C', 'D'].map((n) => camiseta(`Camiseta ${n}`)),
    ...['A', 'B', 'C', 'D'].map((n) => pantalon(`Pantalón ${n}`)),
    zapatos('Zapatillas'),
  ]
  const tres = sugerirOutfits(armario, { clima: { temp: 20 }, hoy })
  const [otra] = sugerirOutfits(armario, { clima: { temp: 20 }, hoy, n: 1, descartar: [tres[0].clave], mantener: [tres[1].ids, tres[2].ids] })
  assert.notEqual(otra.clave, tres[0].clave)
  assert.ok(sonDistintos(otra.ids, tres[1].ids) && sonDistintos(otra.ids, tres[2].ids))
})

test('un vestido sirve de torso y piernas; las archivadas no salen', () => {
  const vestido = prenda('Vestido azul', 'Vestidos')
  const archivada = camiseta('Archivada', { archivada: true })
  const [o] = sugerirOutfits([vestido, archivada, zapatos('Zapatillas')], { clima: { temp: 25 }, hoy })
  assert.equal(o.piezas.vestido.nombre, 'Vestido azul')
  assert.ok(!o.ids.includes(archivada.id))
  assert.deepEqual(sugerirOutfits([archivada], { clima: { temp: 25 }, hoy }), [])
})

test('con 300 prendas calcula en menos de 50 ms', () => {
  const colores = [rojo, azulVivo, negro, { colores: ['#8b5a2b'], familia_color: 'tierra' }, { colores: ['#f4c6d0'], familia_color: 'pastel' }]
  const armario = []
  for (let i = 0; i < 90; i++) armario.push(camiseta(`Camiseta ${i}`, { ...colores[i % 5], abrigo: 1 + (i % 4), temporada: [['verano'], ['invierno'], ['entretiempo']][i % 3] }))
  for (let i = 0; i < 80; i++) armario.push(pantalon(`Pantalón ${i}`, { ...colores[i % 5], abrigo: 2 }))
  for (let i = 0; i < 60; i++) armario.push(zapatos(`Zapatillas ${i}`, colores[i % 5]))
  for (let i = 0; i < 40; i++) armario.push(chaqueta(`Abrigo ${i}`, { ...colores[i % 5], abrigo: 3 + (i % 3) }))
  for (let i = 0; i < 30; i++) armario.push(prenda(`Vestido ${i}`, 'Vestidos', colores[i % 5]))
  assert.equal(armario.length, 300)
  sugerirOutfits(armario, { clima: { temp: 8 }, hoy }) // calentamiento
  const t0 = performance.now()
  const outfits = sugerirOutfits(armario, { clima: { temp: 8 }, hoy })
  const ms = performance.now() - t0
  console.log(`    300 prendas: ${ms.toFixed(1)} ms`)
  assert.equal(outfits.length, 3)
  assert.ok(ms < 50, `tarda ${ms.toFixed(1)} ms`)
})
