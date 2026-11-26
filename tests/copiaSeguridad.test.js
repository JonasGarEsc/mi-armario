import test from 'node:test'
import assert from 'node:assert/strict'
import { exportarDatos, restaurarCopia } from '../src/lib/copiaSeguridad.js'

const archivoCon = (texto) => ({ text: async () => texto })

function espia() {
  const avisos = []
  const confirmaciones = []
  return {
    avisos,
    confirmaciones,
    deps: {
      mostrarToast: (mensaje, tipo) => avisos.push({ mensaje, tipo }),
      solicitarConfirmacionGlobal: (config) => confirmaciones.push(config),
      recargarVistas: () => { throw new Error('no debería recargar sin confirmar') },
    },
  }
}

test('un archivo que no es JSON se rechaza con aviso', async () => {
  const { avisos, confirmaciones, deps } = espia()
  await restaurarCopia({}, archivoCon('no es json'), deps)
  assert.deepEqual(avisos, [{ mensaje: 'Ese archivo no es una copia válida', tipo: 'error' }])
  assert.equal(confirmaciones.length, 0)
})

test('una copia sin prendas ni outfits se rechaza antes de confirmar', async () => {
  const { avisos, confirmaciones, deps } = espia()
  await restaurarCopia({}, archivoCon('{"otra_cosa": true}'), deps)
  assert.deepEqual(avisos, [{ mensaje: 'La copia no tiene prendas ni outfits.', tipo: 'error' }])
  assert.equal(confirmaciones.length, 0)
})

test('si falla una tabla, la exportación se detiene con aviso', async () => {
  const avisos = []
  const consulta = { select: () => consulta, order: () => consulta, range: async () => ({ data: null, error: { message: 'sin permisos' } }) }
  await exportarDatos({ from: () => consulta }, (mensaje, tipo) => avisos.push({ mensaje, tipo }))
  assert.deepEqual(avisos, [{ mensaje: 'No se pudo exportar categorias', tipo: 'error' }])
})

test('una copia válida pide confirmación diciendo cuánto se añadirá', async () => {
  const { confirmaciones, deps } = espia()
  await restaurarCopia({}, archivoCon(JSON.stringify({ prendas: [{ nombre: 'Camiseta' }], conjuntos: [] })), deps)
  assert.equal(confirmaciones.length, 1)
  assert.equal(confirmaciones[0].textoConfirmar, 'Restaurar')
  assert.equal(confirmaciones[0].esDestructivo, false)
  assert.equal(confirmaciones[0].mensaje, '¿Restaurar la copia? Se añadirán 1 prendas y 0 outfits a lo que ya tienes.')
})
