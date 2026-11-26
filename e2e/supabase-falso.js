// Supabase de mentira para la prueba de navegador. Habla el trozo de GoTrue,
// PostgREST y Storage que usa Perletta, sin red externa ni dependencias.
// La lógica de consulta va aparte (y con tests) para poder probarla en Node.

import http from 'node:http'
import { randomUUID } from 'node:crypto'

export const USUARIO = {
  id: '11111111-1111-4111-8111-111111111111',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'perletta@ejemplo.test',
  email_confirmed_at: '2026-01-01T00:00:00.000Z',
  phone: '',
  confirmed_at: '2026-01-01T00:00:00.000Z',
  last_sign_in_at: '2026-01-01T00:00:00.000Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  identities: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

export const CORREO = USUARIO.email
export const CONTRASENA = 'perletta'

const TABLAS = [
  'tipos', 'categorias', 'prendas', 'maletas', 'semanas', 'conjuntos',
  'conjunto_prenda', 'usos', 'maleta_extras', 'valoraciones', 'avisos_push',
]

// Relaciones que la app consulta con select anidado.
const MUCHOS_A_UNO = [
  ['prendas', 'categorias', 'categoria_id'],
  ['categorias', 'tipos', 'tipo_id'],
  ['conjuntos', 'maletas', 'maleta_id'],
  ['conjuntos', 'semanas', 'semana_id'],
  ['conjunto_prenda', 'conjuntos', 'conjunto_id'],
  ['conjunto_prenda', 'prendas', 'prenda_id'],
  ['usos', 'prendas', 'prenda_id'],
  ['maleta_extras', 'maletas', 'maleta_id'],
  ['maleta_extras', 'prendas', 'prenda_id'],
]

const UNO_A_MUCHOS = [
  ['categorias', 'prendas', 'categoria_id'],
  ['tipos', 'categorias', 'tipo_id'],
  ['maletas', 'conjuntos', 'maleta_id'],
  ['semanas', 'conjuntos', 'semana_id'],
  ['conjuntos', 'conjunto_prenda', 'conjunto_id'],
  ['prendas', 'conjunto_prenda', 'prenda_id'],
  ['prendas', 'usos', 'prenda_id'],
  ['maletas', 'maleta_extras', 'maleta_id'],
  ['prendas', 'maleta_extras', 'prenda_id'],
]

/** Convierte `*, categorias(nombre, tipos(id))` en un árbol. */
export function parseSelect(select = '*') {
  const texto = String(select || '*').trim()
  if (!texto || texto === '*') return [{ nombre: '*' }]
  return dividir(texto).map((parte) => {
    const limpio = parte.trim()
    const abre = limpio.indexOf('(')
    if (abre === -1) return { nombre: limpio.split(':').pop() }
    return { nombre: limpio.slice(0, abre).split(':').pop(), hijos: parseSelect(limpio.slice(abre + 1, limpio.lastIndexOf(')'))) }
  })
}

function dividir(texto) {
  const partes = []
  let nivel = 0
  let desde = 0
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] === '(') nivel++
    if (texto[i] === ')') nivel--
    if (texto[i] === ',' && nivel === 0) {
      partes.push(texto.slice(desde, i))
      desde = i + 1
    }
  }
  partes.push(texto.slice(desde))
  return partes.filter((p) => p.trim())
}

/** La relación entre la tabla consultada y el nombre incrustado. */
export function relacion(tabla, nombre) {
  const mucho = MUCHOS_A_UNO.find(([desde, hasta]) => desde === tabla && hasta === nombre)
  if (mucho) return { tipo: 'objeto', clave: mucho[2], tabla: nombre }
  const uno = UNO_A_MUCHOS.find(([desde, hasta]) => desde === tabla && hasta === nombre)
  if (uno) return { tipo: 'lista', clave: uno[2], tabla: nombre }
  return null
}

function valorDe(fila, columna) {
  const valor = fila?.[columna]
  return valor === undefined ? null : valor
}

/** Aplica un select de PostgREST sobre filas planas. */
export function aplicarSelect(filas, select, datos, tabla) {
  return proyectar(filas, parseSelect(select), datos, tabla)
}

function proyectar(filas, arbol, datos, tabla) {
  return filas.map((fila) => {
    const salida = {}
    for (const nodo of arbol) {
      if (nodo.nombre === '*') {
        Object.assign(salida, fila)
        continue
      }
      if (!nodo.hijos) {
        salida[nodo.nombre] = valorDe(fila, nodo.nombre)
        continue
      }
      const rel = relacion(tabla, nodo.nombre)
      if (!rel) {
        salida[nodo.nombre] = null
        continue
      }
      const hijas = datos[rel.tabla] || []
      const unidas = rel.tipo === 'objeto'
        ? hijas.filter((h) => String(h.id) === String(fila[rel.clave]))
        : hijas.filter((h) => String(h[rel.clave]) === String(fila.id))
      const convertidas = proyectar(unidas, nodo.hijos, datos, rel.tabla)
      salida[nodo.nombre] = rel.tipo === 'lista' ? convertidas : (convertidas[0] || null)
    }
    return salida
  })
}

function comparar(a, b) {
  if (a === b) return 0
  if (a === null || a === undefined) return -1
  if (b === null || b === undefined) return 1
  return a < b ? -1 : 1
}

/** Filtros, orden y tramo de una consulta PostgREST. */
export function aplicarConsulta(filas, params, opciones = {}) {
  let resultado = [...filas]
  for (const [columna, filtro] of params.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(columna)) continue
    resultado = resultado.filter((fila) => cumple(fila, columna, filtro))
  }

  const orden = params.get('order')
  if (orden) {
    const criterios = orden.split(',').map((trozo) => {
      const [columna, direccion = 'asc', ...resto] = trozo.trim().split('.')
      return { columna, descendente: direccion === 'desc', nulos: resto[0] }
    })
    resultado.sort((a, b) => {
      for (const c of criterios) {
        const n = comparar(valorDe(a, c.columna), valorDe(b, c.columna))
        if (n !== 0) return c.descendente ? -n : n
      }
      return 0
    })
  }

  const offsetCrudo = params.get('offset')
  const limitCrudo = params.get('limit')
  let offset = offsetCrudo === null ? null : Number(offsetCrudo)
  let limit = limitCrudo === null ? null : Number(limitCrudo)
  if (opciones.range && offset === null && limit === null) {
    offset = opciones.range.desde
    limit = opciones.range.hasta - opciones.range.desde + 1
  }
  if (Number.isFinite(offset) && offset > 0) resultado = resultado.slice(offset)
  if (Number.isFinite(limit) && limit >= 0) resultado = resultado.slice(0, limit)
  return resultado
}

function cumple(fila, columna, filtro) {
  let texto = String(filtro)
  let negado = false
  if (texto.startsWith('not.')) {
    negado = true
    texto = texto.slice(4)
  }
  const punto = texto.indexOf('.')
  const operador = punto === -1 ? texto : texto.slice(0, punto)
  const crudo = punto === -1 ? '' : texto.slice(punto + 1)
  const valor = valorDe(fila, columna)
  let resultado

  switch (operador) {
    case 'eq': resultado = String(valor) === String(crudo); break
    case 'neq': resultado = String(valor) !== String(crudo); break
    case 'in': {
      const lista = crudo.replace(/^\(/, '').replace(/\)$/, '').split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
      resultado = lista.includes(String(valor))
      break
    }
    case 'is':
      resultado = crudo === 'null' ? valor === null || valor === undefined : String(valor) === crudo
      break
    case 'gte': resultado = valor !== null && String(valor) >= crudo; break
    case 'lte': resultado = valor !== null && String(valor) <= crudo; break
    case 'gt': resultado = valor !== null && String(valor) > crudo; break
    case 'lt': resultado = valor !== null && String(valor) < crudo; break
    default: resultado = true
  }
  return negado ? !resultado : resultado
}

function leerRango(cabeceras) {
  const rango = cabeceras.range
  if (!rango) return null
  const m = /^(\d+)-(\d+)$/.exec(String(rango))
  return m ? { desde: Number(m[1]), hasta: Number(m[2]) } : null
}

function filaNueva(tabla, fila) {
  const ahora = new Date().toISOString()
  const base = { id: fila.id || randomUUID(), user_id: fila.user_id || USUARIO.id, creado_en: fila.creado_en || ahora }
  if (tabla === 'prendas') Object.assign(base, { archivada: false, deseada: false })
  if (tabla === 'maleta_extras') base.hecho = false
  if (tabla === 'conjunto_prenda') Object.assign(base, { pos_x: 40, pos_y: 20, z_index: 1, escala: 1, por_dentro: false })
  if (tabla === 'usos') base.fecha = fila.fecha || ahora.slice(0, 10)
  return { ...base, ...fila }
}

function clavesDeConflicto(params) {
  return String(params.get('on_conflict') || 'id').split(',').map((c) => c.trim())
}

/** Inserta filas y sus relaciones anidadas, como PostgREST. */
export function insertarFilas(datos, tabla, filas, params = new URLSearchParams()) {
  const creadas = []
  for (const original of filas) {
    const plano = {}
    const anidadas = []
    for (const [clave, valor] of Object.entries(original)) {
      const rel = relacion(tabla, clave)
      if (rel && rel.tipo === 'lista' && Array.isArray(valor)) {
        anidadas.push({ rel, valor })
      } else {
        plano[clave] = valor
      }
    }
    const fila = filaNueva(tabla, plano)

    const claves = clavesDeConflicto(params)
    const existente = claves.every((c) => fila[c] !== undefined)
      ? datos[tabla].find((f) => claves.every((c) => String(f[c]) === String(fila[c])))
      : null

    let principal = fila
    if (existente) {
      const { id: _id, ...campos } = fila
      Object.assign(existente, campos)
      principal = existente
    } else {
      datos[tabla].push(fila)
    }

    for (const { rel, valor } of anidadas) {
      const hijas = valor.map((h) => filaNueva(rel.tabla, { ...h, [rel.clave]: principal.id }))
      for (const hija of hijas) {
        const ya = datos[rel.tabla].find((f) => rel.tabla === 'conjunto_prenda' && String(f.conjunto_id) === String(hija.conjunto_id) && String(f.prenda_id) === String(hija.prenda_id))
        if (ya) Object.assign(ya, hija)
        else datos[rel.tabla].push(hija)
      }
    }
    creadas.push(principal)
  }
  return creadas
}

/** Borra en cascada lo que la base real borraría. */
export function borrarFilas(datos, tabla, filas) {
  const ids = new Set(filas.map((f) => f.id))
  datos[tabla] = datos[tabla].filter((f) => !ids.has(f.id))
  const cascadas = {
    maletas: [['conjuntos', 'maleta_id'], ['maleta_extras', 'maleta_id']],
    semanas: [['conjuntos', 'semana_id']],
    prendas: [['conjunto_prenda', 'prenda_id'], ['usos', 'prenda_id'], ['maleta_extras', 'prenda_id']],
    conjuntos: [['conjunto_prenda', 'conjunto_id']],
  }
  for (const [hija, clave] of cascadas[tabla] || []) {
    const afectadas = datos[hija].filter((f) => ids.has(f[clave]))
    datos[hija] = datos[hija].filter((f) => !ids.has(f[clave]))
    if (hija === 'conjuntos') borrarFilas(datos, 'conjuntos', afectadas)
  }
}

function fechaLocal(desplazamiento = 0) {
  const d = new Date()
  d.setDate(d.getDate() + desplazamiento)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function hace(dias) {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString()
}

const C = {
  blanco: '#f4f1ea', azul: '#345f8b', gris: '#777c85', negro: '#24262b',
  vaquero: '#4d6e91', lino: '#c9b99b', verde: '#55705a', marron: '#72503b',
}

function svgPrenda(forma, color) {
  const claro = 'rgba(255,255,255,.20)'
  const oscuro = 'rgba(0,0,0,.18)'
  const costura = 'rgba(255,255,255,.34)'
  const cuerpos = {
    camiseta: `
      <path d="M136 120 96 134 53 197l41 31 27-25v218q79 18 158 0V203l27 25 41-31-43-63-40-14q-71 33-128 0Z" fill="${color}"/>
      <path d="M136 120q64 38 128 0-24 42-64 42t-64-42Z" fill="${oscuro}"/>
      <path d="M53 197l41 31 8-11-35-45Z" fill="${claro}"/>
      <path d="M120 421q80 17 160 0" fill="none" stroke="${costura}" stroke-width="2" stroke-dasharray="5 5"/>`,
    camisa: `
      <path d="M137 119 91 137 52 190l38 41 31-22v214q79 15 158 0V209l31 22 38-41-39-53-46-18q-67 23-126 0Z" fill="${color}"/>
      <path d="M137 119l40 34 41-34-18 55h-46Z" fill="${claro}"/>
      <path d="M178 171v249" stroke="${oscuro}" stroke-width="2"/>
      ${[220, 260, 300, 340, 380].map((y) => `<circle cx="178" cy="${y}" r="3.2" fill="${costura}"/>`).join('')}
      <path d="M52 190l38 41 8-9-32-49Z" fill="${claro}"/>`,
    jersey: `
      <path d="M135 118 87 134 55 183l-11 164 44 7 17-105v167q73 15 146 0V249l17 105 44-7-11-164-32-49-48-16q-66 30-126 0Z" fill="${color}"/>
      <path d="M135 118q66 32 126 0-23 43-63 43t-63-43Z" fill="${oscuro}"/>
      <path d="M104 405q74 15 148 0" fill="none" stroke="${costura}" stroke-width="4"/>
      <path d="M55 183l-11 164 44 7 8-31-36-12Z" fill="${claro}"/>`,
    pantalon: `
      <path d="M132 91h136l-8 111-24 226h-48l-3-177-4 177h-48L109 202Z" fill="${color}"/>
      <path d="M132 91h136v35H132Z" fill="${oscuro}"/>
      <path d="M200 127v28" stroke="${costura}" stroke-width="3"/>
      <path d="M143 133q20 8 40 0M217 133q20 8 40 0" fill="none" stroke="${costura}" stroke-width="2"/>`,
    vaquero: `
      <path d="M130 90h140l-7 109-24 229h-51l-3-180-4 180h-51L106 199Z" fill="${color}"/>
      <path d="M130 90h140v33H130Z" fill="${oscuro}"/>
      <path d="M200 125v27" stroke="${costura}" stroke-width="3"/>
      <path d="M142 124h42v34l-21-9-21 9Zm74 0h42v34l-21-9-21 9Z" fill="none" stroke="${costura}" stroke-width="2"/>
      <path d="M124 205q-6 88-5 223M276 205q6 88 5 223" fill="none" stroke="${costura}" stroke-width="2" stroke-dasharray="7 5"/>`,
    falda: `
      <path d="M136 135h128l43 298q-107 24-214 0Z" fill="${color}"/>
      <path d="M136 135h128v34H136Z" fill="${oscuro}"/>
      <path d="M162 169 149 425M200 169v259M238 169l13 256" stroke="${claro}" stroke-width="2"/>
      <path d="M136 135q64 18 128 0" fill="none" stroke="${costura}" stroke-width="3"/>`,
    vestido: `
      <path d="M151 113q49 20 98 0l22 126 57 201q-128 34-256 0l57-201Z" fill="${color}"/>
      <path d="M151 113q49 20 98 0l-9 45q-40 17-80 0Z" fill="${oscuro}"/>
      <path d="M169 239h62" stroke="${costura}" stroke-width="4"/>
      <path d="M200 160v265" stroke="${claro}" stroke-width="1.5"/>`,
    zapatilla: `
      <path d="M69 318c-3 27 7 52 35 56l193 3c33 0 49-17 58-34 7-13-1-25-16-30l-81-24-35-57-51 4 5 62-66 8c-22 3-39 0-42 12Z" fill="${color}"/>
      <path d="M67 359q121 19 294 4l-3 26q-145 19-291-4Z" fill="${oscuro}"/>
      <path d="M176 239l-4 72M200 244l-3 68M225 249l-3 65" stroke="${costura}" stroke-width="3"/>
      <path d="M253 267l55 16" stroke="${costura}" stroke-width="3"/>
      <circle cx="102" cy="334" r="3" fill="${oscuro}"/>`,
    botas: `
      <path d="M148 104h68l7 195 57 64q13 17-5 31l-28 12H145q-15 0-15-16l6-83Z" fill="${color}"/>
      <path d="M148 104h68v30h-68Z" fill="${oscuro}"/>
      <path d="M134 388h137" stroke="${oscuro}" stroke-width="8"/>
      <path d="M168 150h32M166 190h34M164 230h36" stroke="${costura}" stroke-width="3"/>
      <path d="M225 363l49 30" stroke="${claro}" stroke-width="2"/>`,
    chaqueta: `
      <path d="M134 116 83 136 51 187l39 43 31-23v213q79 16 158 0V207l31 23 39-43-32-51-51-20q-64 26-132 0Z" fill="${color}"/>
      <path d="M134 116l44 35-20 36-34-57Zm132 0-44 35 20 36 34-57Z" fill="${claro}"/>
      <path d="M178 187v220" stroke="${oscuro}" stroke-width="2"/>
      ${[235, 275, 315, 355].map((y) => `<circle cx="166" cy="${y}" r="3" fill="${costura}"/>`).join('')}
      <path d="M51 187l39 43 8-9-35-51Z" fill="${claro}"/>`,
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">
  <defs>
    <linearGradient id="luz" x1="0" x2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".16"/>
      <stop offset=".5" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".10"/>
    </linearGradient>
    <filter id="sombra" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="9" stdDeviation="9" flood-color="#17181b" flood-opacity=".16"/>
    </filter>
  </defs>
  <g filter="url(#sombra)">${cuerpos[forma] || cuerpos.camiseta}</g>
</svg>`
}

/** Datos inventados, con fechas relativas al día en que se ejecuta la prueba. */
export function crearDatosDemo() {
  const tipos = [
    { id: 't-arriba', nombre: 'Parte de arriba', creado_en: hace(60) },
    { id: 't-abajo', nombre: 'Parte de abajo', creado_en: hace(60) },
    { id: 't-calzado', nombre: 'Calzado', creado_en: hace(60) },
    { id: 't-vestido', nombre: 'Vestidos', creado_en: hace(60) },
  ]
  const categorias = [
    { id: 'c-camiseta', nombre: 'Camisetas', tipo_id: 't-arriba', creado_en: hace(60) },
    { id: 'c-camisa', nombre: 'Camisas', tipo_id: 't-arriba', creado_en: hace(60) },
    { id: 'c-jersey', nombre: 'Jerséis', tipo_id: 't-arriba', creado_en: hace(60) },
    { id: 'c-chaqueta', nombre: 'Chaquetas', tipo_id: 't-arriba', creado_en: hace(60) },
    { id: 'c-pantalon', nombre: 'Pantalones', tipo_id: 't-abajo', creado_en: hace(60) },
    { id: 'c-vaqueros', nombre: 'Vaqueros', tipo_id: 't-abajo', creado_en: hace(60) },
    { id: 'c-falda', nombre: 'Faldas', tipo_id: 't-abajo', creado_en: hace(60) },
    { id: 'c-zapatillas', nombre: 'Zapatillas', tipo_id: 't-calzado', creado_en: hace(60) },
    { id: 'c-botas', nombre: 'Botas', tipo_id: 't-calzado', creado_en: hace(60) },
    { id: 'c-vestido', nombre: 'Vestidos', tipo_id: 't-vestido', creado_en: hace(60) },
  ]
  const base = (id, nombre, categoria_id, extra) => ({
    id, nombre, categoria_id, imagen_url: '', creado_en: hace(30), etiquetas_auto: true,
    colores: [], temporada: [], abrigo: 2, formalidad: 2, largo: 'cadera', estampado: 'liso',
    precio: null, archivada: false, deseada: false, salida: null, ...extra,
  })
  const prendas = [
    base('p-camiseta', 'Camiseta blanca', 'c-camiseta', { familia_color: 'blanca', colores: ['#f4f1ea'], temporada: ['verano'], abrigo: 1, formalidad: 2, precio: 15, creado_en: hace(25) }),
    base('p-camisa', 'Camisa azul', 'c-camisa', { familia_color: 'azul', colores: ['#345f8b'], temporada: ['entretiempo', 'verano'], abrigo: 2, formalidad: 3, precio: 45, creado_en: hace(22) }),
    base('p-jersey', 'Jersey gris', 'c-jersey', { familia_color: 'gris', colores: ['#777c85'], temporada: ['invierno'], abrigo: 4, formalidad: 2, precio: 60, creado_en: hace(20) }),
    base('p-cazadora', 'Chaqueta vaquera', 'c-chaqueta', { familia_color: 'azul', colores: ['#4d6e91'], temporada: ['entretiempo'], abrigo: 3, formalidad: 2, precio: 75, creado_en: hace(18) }),
    base('p-pantalon', 'Pantalón negro', 'c-pantalon', { familia_color: 'negra', colores: ['#24262b'], temporada: ['invierno', 'entretiempo'], abrigo: 2, formalidad: 3, precio: 50, creado_en: hace(16) }),
    base('p-vaqueros', 'Vaqueros rectos', 'c-vaqueros', { familia_color: 'azul', colores: ['#4d6e91'], temporada: ['entretiempo'], abrigo: 3, formalidad: 1, precio: 70, creado_en: hace(14) }),
    base('p-falda', 'Falda de lino', 'c-falda', { familia_color: 'beige', colores: ['#c9b99b'], temporada: ['verano'], abrigo: 1, formalidad: 2, largo: 'midi', precio: 35, creado_en: hace(12) }),
    base('p-zapatillas', 'Zapatillas blancas', 'c-zapatillas', { familia_color: 'blanca', colores: ['#f4f1ea'], temporada: ['verano', 'entretiempo'], abrigo: 1, formalidad: 1, precio: 80, creado_en: hace(10) }),
    base('p-botas', 'Botas marrones', 'c-botas', { familia_color: 'marron', colores: ['#72503b'], temporada: ['invierno'], abrigo: 3, formalidad: 2, precio: 120, creado_en: hace(8) }),
    base('p-vestido', 'Vestido verde', 'c-vestido', { familia_color: 'verde', colores: ['#55705a'], temporada: ['verano'], abrigo: 1, formalidad: 3, largo: 'midi', precio: 90, creado_en: hace(6) }),
  ]
  const fotos = {
    'p-camiseta': ['camiseta', C.blanco],
    'p-camisa': ['camisa', C.azul],
    'p-jersey': ['jersey', C.gris],
    'p-cazadora': ['chaqueta', C.vaquero],
    'p-pantalon': ['pantalon', C.negro],
    'p-vaqueros': ['vaquero', C.vaquero],
    'p-falda': ['falda', C.lino],
    'p-zapatillas': ['zapatilla', C.blanco],
    'p-botas': ['botas', C.marron],
    'p-vestido': ['vestido', C.verde],
  }
  const archivos = new Map()
  for (const prenda of prendas) {
    const [forma, color] = fotos[prenda.id]
    const ruta = `demo/${prenda.id}.svg`
    archivos.set(ruta, { cuerpo: Buffer.from(svgPrenda(forma, color)), tipo: 'image/svg+xml' })
    prenda.imagen_url = `__URL__/storage/v1/object/public/prendas/${ruta}`
  }

  const inicio = fechaLocal(3)
  const fin = fechaLocal(6)
  const maletas = [{ id: 'm-paris', nombre: 'París', destino: 'París', fecha_inicio: inicio, fecha_fin: fin, creado_en: hace(5) }]
  const conjuntos = [{
    id: 'cj-paris-1', nombre: 'Día 1 · Look de ciudad', maleta_id: 'm-paris', semana_id: null,
    fecha: inicio, creado_en: hace(5),
  }]
  const conjunto_prenda = [
    { conjunto_id: 'cj-paris-1', prenda_id: 'p-camiseta', pos_x: 0, pos_y: 0, z_index: 3, ranura: 'torso', escala: 1, por_dentro: false, user_id: USUARIO.id, creado_en: hace(5) },
    { conjunto_id: 'cj-paris-1', prenda_id: 'p-vaqueros', pos_x: 0, pos_y: 0, z_index: 1, ranura: 'piernas', escala: 1, por_dentro: false, user_id: USUARIO.id, creado_en: hace(5) },
    { conjunto_id: 'cj-paris-1', prenda_id: 'p-zapatillas', pos_x: 0, pos_y: 0, z_index: 5, ranura: 'pies', escala: 1, por_dentro: false, user_id: USUARIO.id, creado_en: hace(5) },
  ]
  const usos = [
    { id: 'u1', prenda_id: 'p-camiseta', fecha: fechaLocal(-20), creado_en: hace(20) },
    { id: 'u2', prenda_id: 'p-vaqueros', fecha: fechaLocal(-40), creado_en: hace(40) },
    { id: 'u3', prenda_id: 'p-zapatillas', fecha: fechaLocal(-10), creado_en: hace(10) },
    { id: 'u4', prenda_id: 'p-pantalon', fecha: fechaLocal(-25), creado_en: hace(25) },
  ]
  const maleta_extras = [
    { id: 'e1', maleta_id: 'm-paris', texto: 'Neceser', prenda_id: null, hecho: true, creado_en: hace(5) },
    { id: 'e2', maleta_id: 'm-paris', texto: 'Cargador', prenda_id: null, hecho: false, creado_en: hace(5) },
  ]

  const datos = { tipos, categorias, prendas, maletas, semanas: [], conjuntos, conjunto_prenda, usos, maleta_extras, valoraciones: [], avisos_push: [] }
  return { datos, archivos }
}

function sesion() {
  const ahora = Math.floor(Date.now() / 1000)
  return {
    access_token: `falso.${USUARIO.id}.${ahora}`,
    refresh_token: `refresco-${ahora}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: ahora + 3600,
    user: USUARIO,
  }
}

function responderFilas(req, res, estado, filas, select, datos, tabla, extra = {}) {
  const proyectadas = aplicarSelect(filas, select, datos, tabla)
  if (String(req.headers.accept || '').includes('application/vnd.pgrst.object+json')) {
    if (proyectadas.length !== 1) {
      escribirJson(res, 406, {
        code: 'PGRST116',
        details: `Results contain ${proyectadas.length} rows, application/vnd.pgrst.object+json requires 1 row`,
        hint: null,
        message: 'JSON object requested, multiple (or no) rows returned',
      }, extra)
      return
    }
    escribirJson(res, estado, proyectadas[0], extra)
    return
  }
  escribirJson(res, estado, proyectadas, extra)
}

function escribirJson(res, estado, cuerpo, extra = {}) {
  const texto = JSON.stringify(cuerpo)
  res.writeHead(estado, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(texto),
    'cache-control': 'no-store',
    ...extra,
  })
  res.end(texto)
}

function cabecerasCors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS',
    'access-control-allow-headers': 'authorization,apikey,content-type,accept,prefer,x-client-info,x-upsert,range,range-unit,accept-profile,content-profile,x-supabase-api-version',
    'access-control-expose-headers': 'content-range,range-unit,content-location',
    'access-control-max-age': '86400',
  }
}

async function leerCuerpo(req) {
  const trozos = []
  for await (const trozo of req) trozos.push(trozo)
  return Buffer.concat(trozos)
}

async function leerJson(req) {
  const cuerpo = await leerCuerpo(req)
  if (!cuerpo.length) return {}
  try { return JSON.parse(cuerpo.toString('utf8')) } catch { return {} }
}

function errorRest(res, estado, mensaje, code = 'PGRST100') {
  escribirJson(res, estado, { code, details: null, hint: null, message: mensaje }, cabecerasCors())
}

/**
 * Arranca el Supabase falso. Devuelve la URL, los datos vivos y cómo cerrarlo.
 * Los datos y archivos se pueden inspeccionar desde el test.
 */
export async function crearSupabaseFalso({ puerto = 0, datos: iniciales } = {}) {
  const demo = iniciales ? { datos: iniciales, archivos: new Map() } : crearDatosDemo()
  const datos = demo.datos
  const archivos = demo.archivos

  const servidor = http.createServer(async (req, res) => {
    const cors = cabecerasCors()
    for (const [k, v] of Object.entries(cors)) res.setHeader(k, v)
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`)
    const ruta = decodeURIComponent(url.pathname)

    try {
      // --- GoTrue ---------------------------------------------------------
      if (ruta.startsWith('/auth/v1/')) {
        if (ruta === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
          const { email, password } = await leerJson(req)
          if (email !== CORREO || password !== CONTRASENA) {
            return escribirJson(res, 400, { error: 'invalid_grant', error_code: 'invalid_credentials', msg: 'Invalid login credentials', message: 'Invalid login credentials' }, cors)
          }
          return escribirJson(res, 200, sesion(), cors)
        }
        if (ruta === '/auth/v1/token') return escribirJson(res, 200, sesion(), cors)
        if (ruta === '/auth/v1/user' && req.method === 'GET') return escribirJson(res, 200, USUARIO, cors)
        if (ruta === '/auth/v1/user' && req.method === 'PUT') return escribirJson(res, 200, USUARIO, cors)
        if (ruta === '/auth/v1/logout') { res.writeHead(204, cors); res.end(); return }
        if (ruta === '/auth/v1/recover') { res.writeHead(200, cors); res.end('{}'); return }
        if (ruta === '/auth/v1/settings') return escribirJson(res, 200, { external: { email: true }, disable_signup: false }, cors)
        return escribirJson(res, 200, {}, cors)
      }

      // --- Edge Functions -------------------------------------------------
      // La app pide etiquetas y lectura de enlaces; sin función desplegada
      // responde vacío y sigue funcionando (no es un error de consola).
      if (ruta.startsWith('/functions/v1/')) {
        return escribirJson(res, 200, {}, cors)
      }

      // --- Storage --------------------------------------------------------
      if (ruta.startsWith('/storage/v1/')) {
        const resto = ruta.slice('/storage/v1/'.length)
        const partes = resto.split('/')
        const firma = partes[0] === 'object' && partes[1] === 'sign'
        const render = partes[0] === 'render' && partes[1] === 'image' && partes[2] === 'sign'
        const publica = partes[0] === 'object' && partes[1] === 'public'
        const subida = partes[0] === 'object' && partes[1] !== 'sign' && partes[1] !== 'public'

        if (firma || render) {
          if (req.method === 'POST') {
            const cuerpo = await leerJson(req)
            const desde = firma ? 3 : 4
            const rutaObjeto = partes.slice(desde).join('/')
            const params = new URLSearchParams()
            if (cuerpo.transform?.width) params.set('width', String(cuerpo.transform.width))
            if (cuerpo.transform?.quality) params.set('quality', String(cuerpo.transform.quality))
            params.set('token', 'firma-falsa')
            const base = render ? '/render/image/sign' : '/object/sign'
            return escribirJson(res, 200, { signedURL: `${base}/prendas/${rutaObjeto.split('/').map(encodeURIComponent).join('/')}?${params}` }, cors)
          }
          const desde = render ? 4 : 3
          const rutaObjeto = partes.slice(desde).join('/')
          return servirArchivo(res, archivos, rutaObjeto, cors)
        }

        if (publica) {
          const rutaObjeto = partes.slice(3).join('/')
          return servirArchivo(res, archivos, rutaObjeto, cors)
        }

        if (subida && req.method === 'DELETE') {
          const { prefixes = [] } = await leerJson(req)
          for (const p of prefixes) archivos.delete(p.replace(/^prendas\//, ''))
          return escribirJson(res, 200, [], cors)
        }
        if (subida && (req.method === 'POST' || req.method === 'PUT')) {
          const rutaObjeto = partes.slice(2).join('/')
          const cuerpo = await leerCuerpo(req)
          const tipo = req.headers['content-type'] || ''
          let archivo = cuerpo
          let contentType = tipo
          if (tipo.startsWith('multipart/form-data')) {
            const form = await new Request('http://falso/', { method: 'POST', headers: { 'content-type': tipo }, body: cuerpo }).formData()
            const entrada = [...form.entries()].find(([, v]) => typeof v === 'object' && v && 'arrayBuffer' in v)
            if (entrada) {
              archivo = Buffer.from(await entrada[1].arrayBuffer())
              contentType = entrada[1].type || 'application/octet-stream'
            }
          }
          archivos.set(rutaObjeto, { cuerpo: archivo, tipo: contentType })
          return escribirJson(res, 200, { Id: randomUUID(), Key: `prendas/${rutaObjeto}` }, cors)
        }
        return escribirJson(res, 200, {}, cors)
      }

      // --- PostgREST ------------------------------------------------------
      if (ruta.startsWith('/rest/v1/rpc/')) {
        return escribirJson(res, 200, true, cors)
      }
      if (ruta.startsWith('/rest/v1/')) {
        const tabla = ruta.slice('/rest/v1/'.length).split('/')[0]
        if (!TABLAS.includes(tabla)) return errorRest(res, 404, `relation "${tabla}" does not exist`, '42P01')

        const select = url.searchParams.get('select') || '*'
        const rango = leerRango(req.headers)
        const filas = datos[tabla]
        const prefer = String(req.headers.prefer || '')

        if (req.method === 'GET' || req.method === 'HEAD') {
          const filtradas = aplicarConsulta(filas, url.searchParams, { range: rango })
          const extra = {}
          if (/count=exact/.test(prefer)) extra['content-range'] = `0-${Math.max(0, filtradas.length - 1)}/${filtradas.length}`
          if (req.method === 'HEAD') {
            res.writeHead(200, { ...cors, ...extra })
            res.end()
            return
          }
          return responderFilas(req, res, 200, filtradas, select, datos, tabla, { ...cors, ...extra })
        }

        if (req.method === 'POST') {
          const cuerpo = await leerJson(req)
          const filasNuevas = Array.isArray(cuerpo) ? cuerpo : [cuerpo]
          const creadas = insertarFilas(datos, tabla, filasNuevas, url.searchParams)
          if (prefer.includes('return=minimal')) { res.writeHead(201, cors); res.end(); return }
          return responderFilas(req, res, 201, creadas, select, datos, tabla, cors)
        }

        if (req.method === 'PATCH') {
          const cuerpo = await leerJson(req)
          const afectadas = aplicarConsulta(filas, url.searchParams, { range: rango })
          for (const fila of afectadas) Object.assign(fila, cuerpo)
          if (prefer.includes('return=minimal')) { res.writeHead(204, cors); res.end(); return }
          return escribirJson(res, 200, aplicarSelect(afectadas, select, datos, tabla), cors)
        }

        if (req.method === 'DELETE') {
          const afectadas = aplicarConsulta(filas, url.searchParams, { range: rango })
          borrarFilas(datos, tabla, afectadas)
          if (prefer.includes('return=representation')) return escribirJson(res, 200, afectadas, cors)
          res.writeHead(204, cors)
          res.end()
          return
        }
        return errorRest(res, 405, 'Método no permitido')
      }

      return errorRest(res, 404, 'No encontrado')
    } catch (error) {
      console.error('[supabase-falso]', error)
      return errorRest(res, 500, error.message || 'Error interno')
    }
  })

  await new Promise((resolver, rechazar) => {
    servidor.once('error', rechazar)
    servidor.listen(puerto, '127.0.0.1', resolver)
  })
  const { port } = servidor.address()
  const base = `http://127.0.0.1:${port}`
  // Las fotos de muestra se siembran con la URL ya resuelta.
  for (const prenda of datos.prendas) {
    if (prenda.imagen_url.startsWith('__URL__')) prenda.imagen_url = prenda.imagen_url.replace('__URL__', base)
  }

  return {
    url: base,
    datos,
    archivos,
    cerrar: () => new Promise((resolver) => servidor.close(resolver)),
  }
}

function servirArchivo(res, archivos, ruta, cors) {
  const archivo = archivos.get(ruta)
  if (!archivo) {
    res.writeHead(404, { ...cors, 'content-type': 'text/plain' })
    res.end('No está')
    return
  }
  res.writeHead(200, {
    ...cors,
    'content-type': archivo.tipo || 'application/octet-stream',
    'content-length': archivo.cuerpo.length,
    'cache-control': 'no-store',
  })
  res.end(archivo.cuerpo)
}
