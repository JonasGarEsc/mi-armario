import test from 'node:test'
import assert from 'node:assert/strict'
import { crearGestorAtras } from '../src/lib/atras.js'

function crearHistory(url = '') {
  const entradas = [{ estado: null, url }]
  let indice = 0
  const oyentes = new Set()
  const avisar = () => { for (const fn of oyentes) fn({ state: entradas[indice].estado }) }

  return {
    get state() { return entradas[indice].estado },
    get length() { return entradas.length },
    get url() { return entradas[indice].url },
    get indice() { return indice },
    pushState(estado, _titulo, nuevaUrl) {
      entradas.splice(indice + 1)
      entradas.push({ estado, url: nuevaUrl === undefined ? entradas[indice].url : nuevaUrl })
      indice++
    },
    back() {
      if (indice === 0) return
      indice--
      avisar()
    },
    addEventListener(tipo, fn) {
      if (tipo === 'popstate') oyentes.add(fn)
    },
    removeEventListener(tipo, fn) {
      oyentes.delete(fn)
    },
  }
}

test('Atrás cierra la hoja, consume su entrada y conserva el hash', () => {
  const history = crearHistory('#access_token=secreto&type=recovery')
  const gestor = crearGestorAtras(history, { programar: (fn) => fn() })
  let cerradas = 0

  gestor.abrir('hoja', () => { cerradas++ })
  assert.equal(history.length, 2)
  assert.equal(history.url, '#access_token=secreto&type=recovery')

  history.back()
  assert.equal(cerradas, 1)
  assert.equal(history.indice, 0)
  assert.equal(history.url, '#access_token=secreto&type=recovery')
})

test('cerrar por la X retira la entrada sin cerrar dos veces', () => {
  const history = crearHistory()
  const gestor = crearGestorAtras(history, { programar: (fn) => fn() })
  let cerradas = 0

  const cerrar = gestor.abrir('hoja', () => { cerradas++ })
  cerrar()
  assert.equal(history.indice, 0)
  assert.equal(cerradas, 0)
  // El efecto puede limpiarse otra vez al desmontar: no debe ir más atrás.
  cerrar()
  assert.equal(history.indice, 0)
  assert.equal(cerradas, 0)
})

test('StrictMode: cerrar y reabrir la misma capa no acumula entradas', () => {
  const history = crearHistory()
  const tareas = []
  const gestor = crearGestorAtras(history, { programar: (fn) => tareas.push(fn) })
  let cerradas = 0

  const cerrar1 = gestor.abrir('hoja', () => { cerradas++ })
  cerrar1()
  assert.equal(history.length, 2)
  assert.equal(tareas.length, 1)

  // React vuelve a montar antes de que corra el turno pendiente.
  gestor.abrir('hoja', () => { cerradas++ })
  tareas.forEach((fn) => fn())
  assert.equal(history.length, 2)
  assert.equal(history.indice, 1)
  assert.equal(cerradas, 0)

  history.back()
  assert.equal(cerradas, 1)
  assert.equal(history.indice, 0)
})

test('cambiar de una hoja a otra no añade entradas', () => {
  const history = crearHistory()
  const tareas = []
  const gestor = crearGestorAtras(history, { programar: (fn) => tareas.push(fn) })

  const cerrarFiltros = gestor.abrir('hoja', () => {})
  cerrarFiltros()
  gestor.abrir('hoja', () => {}) // misma capa con otro tipo de hoja
  tareas.forEach((fn) => fn())

  assert.equal(history.length, 2)
})

test('abrir y cerrar la hoja varias veces no acumula entradas', () => {
  const history = crearHistory()
  const gestor = crearGestorAtras(history, { programar: (fn) => fn() })

  for (let i = 0; i < 3; i++) {
    const cerrar = gestor.abrir('hoja', () => {})
    assert.equal(history.length, 2)
    cerrar()
    assert.equal(history.indice, 0)
  }
  assert.equal(history.length, 2)
})

test('dos confirmaciones seguidas reutilizan la entrada del diálogo', () => {
  const history = crearHistory()
  const tareas = []
  const gestor = crearGestorAtras(history, { programar: (fn) => tareas.push(fn) })
  const cerradas = []
  const flush = () => { tareas.splice(0).forEach((fn) => fn()) }

  gestor.abrir('hoja', () => cerradas.push('hoja'))
  const cerrarPrimera = gestor.abrir('dialogo', () => cerradas.push('primera'))
  cerrarPrimera()
  assert.equal(history.length, 3)

  // La segunda confirmación se abre antes de que corra el turno pendiente.
  const cerrarSegunda = gestor.abrir('dialogo', () => cerradas.push('segunda'))
  flush()
  assert.equal(history.indice, 2)
  assert.deepEqual(cerradas, [])

  cerrarSegunda()
  flush()
  assert.equal(history.indice, 1)
  assert.deepEqual(cerradas, [])

  history.back()
  assert.deepEqual(cerradas, ['hoja'])
  assert.equal(history.indice, 0)
})

test('un diálogo sobre una hoja se cierra antes y cada uno consume su entrada', () => {
  const history = crearHistory()
  const gestor = crearGestorAtras(history, { programar: (fn) => fn() })
  const cerradas = []

  const cerrarHoja = gestor.abrir('hoja', () => cerradas.push('hoja'))
  const cerrarDialogo = gestor.abrir('dialogo', () => cerradas.push('dialogo'))
  assert.equal(history.length, 3)

  history.back()
  assert.deepEqual(cerradas, ['dialogo'])
  assert.equal(history.indice, 1)

  history.back()
  assert.deepEqual(cerradas, ['dialogo', 'hoja'])
  assert.equal(history.indice, 0)

  cerrarDialogo()
  cerrarHoja()
  assert.equal(history.indice, 0)
})

test('cerrar el diálogo con la X vuelve a dejar la hoja protegida', () => {
  const history = crearHistory()
  const gestor = crearGestorAtras(history, { programar: (fn) => fn() })
  const cerradas = []

  const cerrarHoja = gestor.abrir('hoja', () => cerradas.push('hoja'))
  const cerrarDialogo = gestor.abrir('dialogo', () => cerradas.push('dialogo'))
  cerrarDialogo()
  assert.equal(history.indice, 1)
  assert.deepEqual(cerradas, [])

  history.back()
  assert.deepEqual(cerradas, ['hoja'])
  assert.equal(history.indice, 0)
  cerrarHoja()
})

test('popstate se escucha en window: el History real no admite eventos', () => {
  const falso = crearHistory()
  const history = { get state() { return falso.state }, pushState: falso.pushState, back: falso.back }
  let cerradas = 0
  crearGestorAtras(history, { eventos: falso, programar: (fn) => fn() }).abrir('hoja', () => { cerradas++ })
  falso.back()
  assert.equal(cerradas, 1)
})
