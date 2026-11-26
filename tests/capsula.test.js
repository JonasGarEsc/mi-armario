import test from 'node:test'
import assert from 'node:assert/strict'
import { crearCapsula, diasDelViaje, extrasDeViaje } from '../src/lib/capsula.js'

let n = 0
const prenda = (nombre, categoria, extra = {}) => ({
  id: `p${++n}`, nombre, categorias: { nombre: categoria, tipos: { nombre: 'Ropa' } }, usos: [], creado_en: '2026-01-01T00:00:00Z', ...extra,
})
const neutro = { colores: ['#111111'], familia_color: 'neutro' }
const vivo = (hex) => ({ colores: [hex], familia_color: 'vivo' })

function armario() {
  const a = []
  for (const c of ['negra', 'blanca', 'gris', 'beige']) a.push(prenda(`Camiseta ${c}`, 'Camisetas', { ...neutro, abrigo: 2 }))
  for (const c of ['negro', 'vaquero', 'beige']) a.push(prenda(`Pantalón ${c}`, 'Pantalones', { ...neutro, abrigo: 2 }))
  a.push(prenda('Zapatillas blancas', 'Zapatillas', neutro), prenda('Zapatillas negras', 'Zapatillas', neutro), prenda('Botas', 'Zapatillas', neutro))
  a.push(prenda('Chaqueta', 'Abrigos', { ...neutro, abrigo: 4 }))
  // Distracciones llamativas: no deberían entrar en una cápsula.
  for (const hex of ['#e02020', '#2040e0', '#20c040', '#e0c020']) {
    a.push(prenda(`Camiseta ${hex}`, 'Camisetas', { ...vivo(hex), abrigo: 2 }), prenda(`Pantalón ${hex}`, 'Pantalones', { ...vivo(hex), abrigo: 2 }))
  }
  return a
}
const dias = (cuantos, clima = { temp: 20 }) => diasDelViaje('2026-12-01', `2026-12-${String(cuantos).padStart(2, '0')}`).map((fecha) => ({ fecha, clima }))
const claves = (r) => r.outfits.map((o) => o.clave)

test('los días del viaje, de ida a vuelta', () => {
  assert.deepEqual(diasDelViaje('2026-12-30', '2027-01-02'), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
  assert.deepEqual(diasDelViaje('2026-12-05', null), ['2026-12-05'])
  assert.deepEqual(diasDelViaje(null, null), [])
  assert.equal(diasDelViaje('2026-01-01', '2026-12-31').length, 21)
})

test('un outfit distinto cada día', () => {
  const r = crearCapsula(armario(), dias(7))
  assert.equal(r.outfits.length, 7)
  assert.equal(new Set(claves(r)).size, 7, 'hay outfits repetidos')
  assert.equal(r.resumen.repetidos, 0)
  assert.deepEqual(r.sinOutfit, [])
})

test('la maleta es pequeña: reutiliza básicos y deja las prendas llamativas', () => {
  const ropa = armario()
  const r = crearCapsula(ropa, dias(7))
  // Con 2 pares de arriba y 3 de abajo (o 3 y 2) salen 6 combinaciones; hacen falta 7 → 3×3 = 9 como mucho.
  assert.ok(r.resumen.prendas <= 9, `usa ${r.resumen.prendas} prendas`)
  const nombres = r.prendasIds.map((id) => ropa.find((p) => p.id === id).nombre)
  assert.ok(!nombres.some((x) => /#/.test(x)), `entran prendas llamativas: ${nombres}`)
})

test('como mucho tantos pares de zapatos como se pida', () => {
  const ropa = armario()
  const esZapato = (id) => /Zapatillas|Botas/.test(ropa.find((p) => p.id === id).nombre)
  for (const max of [1, 2]) {
    const r = crearCapsula(ropa, dias(6), { maxZapatos: max })
    assert.ok(r.prendasIds.filter(esZapato).length <= max)
    assert.equal(r.outfits.length, 6)
  }
})

test('con frío entra el abrigo y con calor no', () => {
  const ropa = armario()
  const frio = crearCapsula(ropa, dias(3, { temp: 3 }))
  assert.ok(frio.outfits.every((o) => o.piezas.abrigo), 'todos los días fríos llevan abrigo')
  const calor = crearCapsula(ropa, dias(3, { temp: 30 }))
  assert.ok(calor.outfits.every((o) => !o.piezas.abrigo))
})

test('si el armario no da para tantos días distintos, repite y lo avisa', () => {
  const poco = [prenda('Camiseta', 'Camisetas', neutro), prenda('Pantalón', 'Pantalones', neutro), prenda('Zapatillas', 'Zapatillas', neutro)]
  const r = crearCapsula(poco, dias(4))
  assert.equal(r.outfits.length, 4)
  assert.equal(r.resumen.repetidos, 3)
  assert.equal(r.resumen.prendas, 3)
})

test('sin prendas para vestirse, el día queda sin outfit', () => {
  const r = crearCapsula([prenda('Zapatillas', 'Zapatillas', neutro)], dias(2))
  assert.equal(r.outfits.length, 0)
  assert.equal(r.sinOutfit.length, 2)
})

test('otra semilla da otra cápsula igual de válida', () => {
  const ropa = armario()
  const a = crearCapsula(ropa, dias(5), { semilla: 0 })
  const b = crearCapsula(ropa, dias(5), { semilla: 7 })
  assert.equal(new Set(claves(b)).size, 5)
  assert.ok(b.resumen.prendas <= 9)
  assert.ok(a.outfits.length === 5 && b.outfits.length === 5)
})

test('el resultado sale en el orden de los días', () => {
  const d = dias(5)
  const r = crearCapsula(armario(), d)
  assert.deepEqual(r.outfits.map((o) => o.fecha), d.map((x) => x.fecha))
})

test('una cápsula de 14 días con 300 prendas tarda poco', () => {
  const ropa = []
  for (let i = 0; i < 100; i++) ropa.push(prenda(`Camiseta ${i}`, 'Camisetas', { ...(i % 3 ? vivo('#2040e0') : neutro), abrigo: 1 + (i % 3) }))
  for (let i = 0; i < 80; i++) ropa.push(prenda(`Pantalón ${i}`, 'Pantalones', { ...(i % 3 ? vivo('#e02020') : neutro), abrigo: 2 }))
  for (let i = 0; i < 60; i++) ropa.push(prenda(`Zapatillas ${i}`, 'Zapatillas', neutro))
  for (let i = 0; i < 60; i++) ropa.push(prenda(`Abrigo ${i}`, 'Abrigos', { ...neutro, abrigo: 3 + (i % 3) }))
  const d = dias(14, { temp: 12 })
  const t0 = performance.now()
  const r = crearCapsula(ropa, d)
  const ms = performance.now() - t0
  console.log(`    14 días con ${ropa.length} prendas: ${ms.toFixed(0)} ms, ${r.resumen.prendas} prendas`)
  assert.equal(new Set(claves(r)).size, 14)
  assert.ok(ms < 3000, `tarda ${ms.toFixed(0)} ms`)
})

test('lista de extras: según destino, duración y tiempo', () => {
  const base = extrasDeViaje({ dias: dias(3), paisDestino: 'ES', paisOrigen: 'ES' })
  assert.ok(base.includes('Neceser') && base.includes('Cargador del móvil') && base.includes('DNI'))
  assert.ok(!base.includes('Paraguas plegable') && !base.includes('Adaptador de enchufe'))

  const lejos = extrasDeViaje({ dias: dias(9, { temp: 28, max: 31, min: 22, lluvia: true }), paisDestino: 'GB', paisOrigen: 'ES' })
  for (const x of ['Pasaporte', 'Adaptador de enchufe', 'Paraguas plegable', 'Crema solar', 'Bolsa para la ropa sucia', 'Detergente de viaje']) assert.ok(lejos.includes(x), x)

  const europa = extrasDeViaje({ dias: dias(2), paisDestino: 'FR', paisOrigen: 'ES' })
  assert.ok(europa.includes('DNI o pasaporte') && !europa.includes('Adaptador de enchufe'))

  const playa = extrasDeViaje({ dias: [{ fecha: 'x', clima: { temp: 30 }, ocasion: 'playa' }] })
  assert.ok(playa.includes('Bañador') && playa.includes('Toalla de playa'))
  const nieve = extrasDeViaje({ dias: dias(2, { temp: -2, min: -6, max: 1 }) })
  assert.ok(nieve.includes('Gorro, bufanda y guantes'))
})
