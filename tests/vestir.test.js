import test from 'node:test'
import assert from 'node:assert/strict'
import { CUERPO, VESTIR } from '../src/lib/maniqui.js'
import { medirAnchura, vestirPrenda } from '../src/lib/vestir.js'

const cerca = (a, b, margen = 1e-6) => Math.abs(a - b) < margen

// Perfil de 40 filas: `cuerpo` de ancho salvo en las filas de `mangas`.
function perfil(cuerpo, mangas = 0, filasMangas = 0) {
  return Array.from({ length: 40 }, (_, i) => (i < filasMangas ? mangas : cuerpo))
}

test('una camiseta se escala por el ancho de su cuerpo, no de sus mangas', () => {
  const caja = { x: 0.1, y: 0.1, w: 0.8, h: 0.8, relacion: 1, perfil: perfil(0.5, 0.8, 12) }
  const puesta = vestirPrenda(caja, 'torso')
  // El cuerpo (50 % de la foto) mide lo que el torso del maniquí con holgura.
  assert.ok(cerca(0.5 * puesta.w, VESTIR.torso.ancho))
  // Cuelga de la base del cuello y está centrada.
  assert.ok(cerca(puesta.y + caja.y * puesta.h, CUERPO.cuello))
  assert.ok(cerca(puesta.x + (caja.x + caja.w / 2) * puesta.w, 50))
})

test('la misma prenda fotografiada con más aire sale del mismo tamaño', () => {
  const cerca1 = { x: 0.1, y: 0.1, w: 0.8, h: 0.8, relacion: 1, perfil: perfil(0.4) }
  const lejos = { x: 0.3, y: 0.3, w: 0.4, h: 0.4, relacion: 1, perfil: perfil(0.2) }
  const a = vestirPrenda(cerca1, 'piernas')
  const b = vestirPrenda(lejos, 'piernas')
  assert.ok(cerca(cerca1.h * a.h, lejos.h * b.h), 'el largo visible cambia')
  assert.ok(cerca(cerca1.w * a.w, lejos.w * b.w), 'el ancho visible cambia')
})

test('el pantalón se ajusta por la cinturilla y empieza en la cintura', () => {
  // Cinturilla estrecha arriba, perneras anchas abajo (pantalón de vuelo).
  const p = Array.from({ length: 40 }, (_, i) => (i < 3 ? 0.3 : 0.6))
  const caja = { x: 0.2, y: 0.05, w: 0.6, h: 0.9, relacion: 1.2, perfil: p }
  const puesta = vestirPrenda(caja, 'piernas')
  assert.ok(cerca(0.3 * puesta.w, VESTIR.piernas.ancho))
  assert.ok(cerca(puesta.y + caja.y * puesta.h, VESTIR.piernas.arriba))
})

test('un largo imposible se corrige', () => {
  // Cinturilla diminuta: sin límite, el pantalón mediría varios maniquíes.
  const caja = { x: 0.45, y: 0, w: 0.1, h: 1, relacion: 1, perfil: perfil(0.02) }
  const puesta = vestirPrenda(caja, 'piernas')
  assert.ok(caja.h * puesta.h <= VESTIR.piernas.alto[1] + 1e-9)
})

test('el calzado cabe en los pies, apoyado en el suelo, sin deformarse', () => {
  const caja = { x: 0.1, y: 0.3, w: 0.8, h: 0.4, relacion: 1.5 }
  const puesta = vestirPrenda(caja, 'pies')
  const zona = VESTIR.pies.zona
  assert.ok(caja.w * puesta.w <= zona.w + 1e-9)
  assert.ok(caja.h * puesta.h <= zona.h + 1e-9)
  assert.ok(cerca(puesta.y + (caja.y + caja.h) * puesta.h, zona.y + zona.h))
  assert.ok(cerca(puesta.w / puesta.h, caja.relacion))
})

test('puesta, la prenda se estrecha por la envoltura pero conserva el largo', () => {
  const caja = { x: 0.1, y: 0.1, w: 0.8, h: 0.8, relacion: 1, perfil: perfil(0.5) }
  const puesta = vestirPrenda(caja, 'torso')
  assert.ok(cerca(puesta.w / puesta.h, VESTIR.torso.envoltura))
})

test('sin caja o sin regla no se viste', () => {
  assert.equal(vestirPrenda(null, 'torso'), null)
  assert.equal(vestirPrenda({ x: 0, y: 0, w: 1, h: 1, relacion: 1 }, 'accesorio'), null)
})

test('medirAnchura ignora filas vacías y respeta el percentil', () => {
  const caja = { perfil: [0, 0.2, 0.4, 0.6, 0.8] }
  assert.equal(medirAnchura(caja, 0, 1, 0), 0.2)
  assert.equal(medirAnchura(caja, 0, 1, 1), 0.8)
  assert.equal(medirAnchura({}, 0, 1), null)
})
