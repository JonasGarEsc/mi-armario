import test from 'node:test'
import assert from 'node:assert/strict'
import { CUERPO, VESTIR } from '../src/lib/maniqui.js'
import { DEFORMACION, largoPorNombre, medirAnchura, reglaDePrenda, vestirPrenda } from '../src/lib/vestir.js'

const cerca = (a, b, margen = 1e-6) => Math.abs(a - b) < margen
const perfil = (ancho) => Array.from({ length: 40 }, () => ancho)
// Borde superior e inferior de la parte visible, en % del escenario.
const cima = (caja, p) => p.y + caja.y * p.h
const bajo = (caja, p) => p.y + (caja.y + caja.h) * p.h

// Camiseta entallada como la de adidas: alta respecto a su anchura.
const camiseta = { x: 0.25, y: 0.2, w: 0.5, h: 0.6, relacion: 1, perfil: perfil(0.36) }

test('una camiseta cuelga del cuello y acaba en la cadera, no en las rodillas', () => {
  const p = vestirPrenda(camiseta, 'torso', ['Camiseta adidas', 'Camisetas', 'Ropa'])
  assert.ok(cerca(cima(camiseta, p), CUERPO.cuello))
  assert.ok(cerca(bajo(camiseta, p), 44))
  assert.ok(bajo(camiseta, p) < CUERPO.entrepierna)
})

test('un top acaba por encima del ombligo', () => {
  const p = vestirPrenda(camiseta, 'torso', ['Top negro', 'Camisetas'])
  assert.ok(bajo(camiseta, p) < CUERPO.ombligo)
})

test('una categoría «Tops» no convierte una camiseta en top corto', () => {
  const p = vestirPrenda(camiseta, 'torso', ['Básica blanca', 'Tops'])
  assert.ok(bajo(camiseta, p) > CUERPO.ombligo)
})

test('sin pistas en el nombre, el largo sale de la forma de la foto', () => {
  // Muy ancha y baja: un top corto.
  const corta = { x: 0.1, y: 0.35, w: 0.8, h: 0.3, relacion: 1, perfil: perfil(0.7) }
  const p = vestirPrenda(corta, 'torso', ['Prenda 12'])
  assert.ok(bajo(corta, p) < CUERPO.ombligo)
})

test('el pantalón empieza por debajo del ombligo y se ajusta a un largo real', () => {
  // Pantalón ancho 3/4: cinturilla de un tercio de la foto, alto 0,73.
  const p3 = Array.from({ length: 40 }, (_, i) => (i < 3 ? 0.33 : 0.5))
  const pantalon = { x: 0.25, y: 0.13, w: 0.5, h: 0.73, relacion: 1, perfil: p3 }
  const p = vestirPrenda(pantalon, 'piernas', ['Pantalón', 'Pantalones'])
  assert.ok(cima(pantalon, p) > CUERPO.ombligo)
  assert.ok(VESTIR.piernas.posibles.some((b) => cerca(bajo(pantalon, p), b)))
})

test('el nombre manda sobre la forma: unos shorts son cortos', () => {
  const vaquero = { x: 0.3, y: 0.05, w: 0.4, h: 0.9, relacion: 1, perfil: perfil(0.3) }
  const p = vestirPrenda(vaquero, 'piernas', ['Shorts vaqueros'])
  assert.ok(cerca(bajo(vaquero, p), 53))
})

test('una falda se viste desde la cintura', () => {
  assert.equal(reglaDePrenda('piernas', ['Falda midi']), VESTIR.falda)
  const falda = { x: 0.2, y: 0.1, w: 0.6, h: 0.8, relacion: 1, perfil: perfil(0.4) }
  const p = vestirPrenda(falda, 'piernas', ['Falda midi'])
  assert.ok(cerca(cima(falda, p), VESTIR.falda.arriba))
  assert.ok(cerca(bajo(falda, p), 76))
})

test('la foto nunca se deforma más de lo permitido', () => {
  // Cuerpo diminuto: pediría una prenda anchísima para su largo.
  const rara = { x: 0.45, y: 0.1, w: 0.1, h: 0.8, relacion: 1, perfil: perfil(0.02) }
  const p = vestirPrenda(rara, 'torso', ['Camiseta'])
  const natural = (p.h * VESTIR.torso.envoltura) / p.w // 1 = sin deformar
  assert.ok(natural >= DEFORMACION[0] - 1e-9 && natural <= DEFORMACION[1] + 1e-9)
})

test('el calzado cabe en los pies, apoyado en el suelo, sin deformarse', () => {
  const caja = { x: 0.1, y: 0.3, w: 0.8, h: 0.4, relacion: 1.5 }
  const p = vestirPrenda(caja, 'pies')
  const zona = VESTIR.pies.zona
  assert.ok(caja.w * p.w <= zona.w + 1e-9)
  assert.ok(caja.h * p.h <= zona.h + 1e-9)
  assert.ok(cerca(bajo(caja, p), zona.y + zona.h))
  assert.ok(cerca(p.w / p.h, caja.relacion))
})

test('sin caja o sin regla no se viste', () => {
  assert.equal(vestirPrenda(null, 'torso'), null)
  assert.equal(vestirPrenda({ x: 0, y: 0, w: 1, h: 1, relacion: 1 }, 'accesorio'), null)
})

test('largoPorNombre busca en nombre, luego categoría y luego tipo', () => {
  assert.equal(largoPorNombre(VESTIR.abrigo, ['Mi favorita', 'Abrigos']), CUERPO.rodilla)
  assert.equal(largoPorNombre(VESTIR.abrigo, ['Chaleco acolchado', 'Abrigos']), 44)
  assert.equal(largoPorNombre(VESTIR.abrigo, ['Sin pistas']), null)
})

test('medirAnchura ignora filas vacías y respeta el percentil', () => {
  const caja = { perfil: [0, 0.2, 0.4, 0.6, 0.8] }
  assert.equal(medirAnchura(caja, 0, 1, 0), 0.2)
  assert.equal(medirAnchura(caja, 0, 1, 1), 0.8)
  assert.equal(medirAnchura({}, 0, 1), null)
})
