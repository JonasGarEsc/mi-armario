import test from 'node:test'
import assert from 'node:assert/strict'
import { compartirImagen } from '../src/lib/exportar.js'

const imagen = { dataUrl: 'data:image/png;base64,xx', file: { name: 'a.png' } }
const conNavigator = (nav, fn) => {
  const antes = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true })
  const restaurar = () => (antes ? Object.defineProperty(globalThis, 'navigator', antes) : delete globalThis.navigator)
  return fn().finally(restaurar)
}
const documento = () => {
  const clics = []
  globalThis.document = {
    body: { appendChild() {} },
    createElement: () => ({ click() { clics.push('clic') }, remove() {} }),
  }
  return clics
}

test('comparte con el menú del sistema cuando se puede', () =>
  conNavigator({ canShare: () => true, share: async (d) => { assert.equal(d.files.length, 1) } }, async () => {
    const r = await compartirImagen(async () => imagen, 'Outfit')
    assert.equal(r.estado, 'compartido')
  }))

test('sin Web Share, descarga la imagen', () =>
  conNavigator({}, async () => {
    const clics = documento()
    const r = await compartirImagen(async () => imagen, 'Outfit')
    assert.equal(r.estado, 'descargado')
    assert.equal(clics.length, 1)
  }))

test('si no se puede compartir archivos, también descarga', () =>
  conNavigator({ canShare: () => false, share: async () => { throw new Error('no debería llamarse') } }, async () => {
    documento()
    assert.equal((await compartirImagen(async () => imagen, 'x')).estado, 'descargado')
  }))

test('cancelar el menú no es un error', () =>
  conNavigator({ canShare: () => true, share: async () => { const e = new Error('x'); e.name = 'AbortError'; throw e } }, async () => {
    assert.equal((await compartirImagen(async () => imagen, 'x')).estado, 'cancelado')
  }))

test('si iOS lo niega por tardar, se pide reintentar con la imagen ya hecha', () =>
  conNavigator({ canShare: () => true, share: async () => { const e = new Error('x'); e.name = 'NotAllowedError'; throw e } }, async () => {
    const r = await compartirImagen(async () => imagen, 'x')
    assert.equal(r.estado, 'reintentar')
    assert.equal(r.file, imagen.file)
  }))

test('otro error se propaga', () =>
  conNavigator({ canShare: () => true, share: async () => { throw new Error('rotura') } }, async () => {
    await assert.rejects(() => compartirImagen(async () => imagen, 'x'), /rotura/)
  }))
