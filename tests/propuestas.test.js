import test from 'node:test'
import assert from 'node:assert/strict'
import { comoConjunto } from '../src/lib/propuestas.js'

test('la propuesta se convierte en un conjunto que entiende el lienzo', () => {
  const prenda = {
    id: 'p1',
    nombre: 'Camiseta',
    imagen_url: 'camiseta.webp',
    categorias: { nombre: 'Camisetas', tipos: { nombre: 'Ropa' } },
  }
  const conjunto = comoConjunto({
    clave: 'a|b',
    piezas: { torso: prenda, piernas: null, vestido: null, abrigo: null, pies: null },
  })

  assert.equal(conjunto.id, 'sug-a|b')
  assert.equal(conjunto.conjunto_prenda.length, 1)
  assert.equal(conjunto.conjunto_prenda[0].prenda_id, 'p1')
  assert.equal(conjunto.conjunto_prenda[0].ranura, 'torso')
  assert.equal(conjunto.conjunto_prenda[0].prendas, prenda)
})
