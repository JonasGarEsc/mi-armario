// Maleta mínima: el menor número de prendas que da un outfit distinto cada día.
//
// Es un problema de cobertura (parecido al «set cover»): encontrar el conjunto más
// pequeño de prendas con el que se pueda montar un outfit por día, sin repetir
// ninguno. Resolverlo exactamente es inviable, así que se usa una heurística en dos
// pasos, que da resultados muy cercanos al óptimo con armarios de cientos de prendas:
//
//  1. Voraz con reutilización. Los días se recorren del más frío al más cálido (los
//     que más condicionan: piden abrigo) y para cada uno se elige el mejor outfit
//     dando puntos a las prendas que YA van en la maleta y restándolos a las nuevas.
//     Así los básicos neutros se reparten por todos los días en vez de añadir una
//     prenda nueva por cada outfit.
//  2. Mejora local. Se intenta quitar cada prenda de la maleta (empezando por la que
//     menos se usa) y volver a montar todos los días solo con las que quedan; si se
//     puede sin repetir outfits, la maleta se queda una prenda más corta. Se repite
//     hasta que ninguna se pueda quitar.

import { huecoDe, sugerirOutfits } from './sugerir.js'

const REUTILIZAR = 4 // puntos a una prenda que ya va en la maleta
const PRENDA_NUEVA = -1.5 // coste de añadir una prenda a la maleta
const POR_REPETIDA = -0.6 // más caro añadir otra del mismo hueco: equilibra arriba y abajo
const BASICO = 0.8 // las neutras combinan con todo; las llamativas y estampadas, con poco
const LLAMATIVA = -0.6
const CANDIDATOS = 40 // outfits que se consideran por día
const PASADAS = 3 // vueltas de mejora local
export const MAX_DIAS = 21

/** Los días (YYYY-MM-DD) de un viaje, de ida a vuelta, con un tope razonable. */
export function diasDelViaje(inicio, fin, tope = MAX_DIAS) {
  if (!inicio) return []
  const [y, m, d] = inicio.split('-').map(Number)
  const ultimo = fin || inicio
  const dias = []
  for (let i = 0; i < tope; i++) {
    const f = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10)
    if (f > ultimo) break
    dias.push(f)
  }
  return dias
}

// Generador pseudoaleatorio pequeño y determinista (mulberry32): «otra cápsula» usa otra semilla.
function aleatorio(semilla) {
  let t = semilla >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function resolverDias(prendas, dias, { maxZapatos, semilla, conCoste, hayCalzado, hayAbrigo }) {
  const huecoPorId = new Map(prendas.map((p) => [p.id, huecoDe(p)]))
  const azar = semilla ? aleatorio(semilla) : null
  const ruido = new Map()
  if (azar) for (const p of prendas) ruido.set(p.id, azar() * 1.6)

  const orden = dias.map((dia, indice) => ({ dia, indice })).sort((a, b) => a.dia.clima.temp - b.dia.clima.temp)
  const capsula = new Set()
  const zapatos = new Set()
  const usados = new Set()
  const asignado = new Array(dias.length).fill(null)

  for (const { dia, indice } of orden) {
    // Cuántas hay ya en la maleta de cada hueco: la siguiente cuesta más.
    const porHueco = {}
    for (const id of capsula) {
      const h = huecoPorId.get(id)
      porHueco[h] = (porHueco[h] || 0) + 1
    }
    const bonus = new Map()
    for (const p of prendas) {
      let punto = ruido.get(p.id) ?? 0
      if (capsula.has(p.id)) punto += REUTILIZAR
      else if (conCoste) punto += PRENDA_NUEVA + POR_REPETIDA * (porHueco[huecoPorId.get(p.id)] || 0)
      if (conCoste) punto += p.familia_color === 'neutro' ? BASICO : p.familia_color === 'vivo' || (p.estampado && p.estampado !== 'liso') ? LLAMATIVA : 0
      bonus.set(p.id, punto)
    }
    const opciones = {
      clima: dia.clima, hoy: dia.fecha, ocasion: dia.ocasion || 'cualquiera',
      n: CANDIDATOS, bonus, minimoDiferencia: 1, descanso: 0,
      requerir: { pies: hayCalzado, abrigo: hayAbrigo && dia.clima.temp < 16 },
    }
    const cabe = (o) => {
      const pies = o.piezas.pies?.id
      return !pies || zapatos.has(pies) || zapatos.size < maxZapatos
    }

    let elegido = sugerirOutfits(prendas, { ...opciones, descartar: [...usados] }).find(cabe)
    let repetido = false
    if (!elegido) {
      // No queda combinación nueva: se repite uno ya usado antes que dejar el día sin outfit.
      elegido = sugerirOutfits(prendas, opciones).find(cabe)
      repetido = Boolean(elegido)
    }
    if (!elegido) continue

    for (const id of elegido.ids) capsula.add(id)
    if (elegido.piezas.pies) zapatos.add(elegido.piezas.pies.id)
    usados.add(elegido.clave)
    asignado[indice] = { ...elegido, fecha: dia.fecha, repetido }
  }

  return {
    capsula,
    asignado,
    completa: asignado.every(Boolean),
    repetidos: asignado.filter((a) => a?.repetido).length,
  }
}

/**
 * Cápsula de viaje.
 *
 * `prendas`: el armario (con etiquetas). `dias`: [{ fecha, clima: { temp, lluvia }, ocasion? }].
 * `opciones`: maxZapatos (pares como mucho, 2 por defecto), semilla (otra cápsula distinta).
 * Devuelve { outfits (uno por día, en orden), prendasIds, resumen, sinOutfit (días sin solución) }.
 */
export function crearCapsula(prendas, dias, { maxZapatos = 2, semilla = 0 } = {}) {
  if (dias.length === 0) {
    return { outfits: [], prendasIds: [], resumen: { prendas: 0, outfits: 0, repetidos: 0 }, sinOutfit: [] }
  }

  // Si el armario tiene calzado o abrigo, ningún outfit de la maleta se queda sin ellos.
  const hayCalzado = prendas.some((p) => !p.archivada && huecoDe(p) === 'pies')
  const hayAbrigo = prendas.some((p) => !p.archivada && huecoDe(p) === 'abrigo')
  const comun = { maxZapatos, hayCalzado, hayAbrigo }
  let mejor = resolverDias(prendas, dias, { ...comun, semilla, conCoste: true })
  const porId = new Map(prendas.map((p) => [p.id, p]))

  // Mejora local: quitar prendas mientras se pueda seguir montando todos los días.
  for (let pasada = 0; pasada < PASADAS; pasada++) {
    const usos = new Map()
    for (const o of mejor.asignado) for (const id of o?.ids || []) usos.set(id, (usos.get(id) || 0) + 1)
    const porUso = [...mejor.capsula].sort((a, b) => usos.get(a) - usos.get(b))

    let mejoro = false
    for (const id of porUso) {
      const resto = [...mejor.capsula].filter((x) => x !== id).map((x) => porId.get(x)).filter(Boolean)
      const prueba = resolverDias(resto, dias, { ...comun, semilla: 0, conCoste: false })
      const noPeor = prueba.completa && prueba.repetidos <= mejor.repetidos
      const aunMejor = mejor.completa ? noPeor : prueba.completa || prueba.asignado.filter(Boolean).length >= mejor.asignado.filter(Boolean).length
      if (aunMejor && prueba.capsula.size < mejor.capsula.size) {
        mejor = prueba
        mejoro = true
        break
      }
    }
    if (!mejoro) break
  }

  const outfits = mejor.asignado.filter(Boolean)
  return {
    outfits,
    prendasIds: [...mejor.capsula],
    resumen: { prendas: mejor.capsula.size, outfits: outfits.length, repetidos: mejor.repetidos },
    sinOutfit: dias.filter((_, i) => !mejor.asignado[i]).map((d) => d.fecha),
  }
}

// --- Lista de lo que no es ropa ---------------------------------------------

// Países con enchufe tipo C/F (el de España): no hace falta adaptador.
const ENCHUFE_EUROPEO = new Set(['ES', 'FR', 'DE', 'IT', 'PT', 'NL', 'BE', 'AT', 'LU', 'FI', 'GR', 'PL', 'CZ', 'SK', 'SI', 'SE', 'NO', 'HU', 'HR', 'RO', 'BG', 'LT', 'LV', 'EE', 'IS', 'DK', 'AD', 'MC'])
const UE = new Set(['ES', 'FR', 'DE', 'IT', 'PT', 'NL', 'BE', 'AT', 'LU', 'FI', 'GR', 'PL', 'CZ', 'SK', 'SI', 'SE', 'HU', 'HR', 'RO', 'BG', 'LT', 'LV', 'EE', 'DK', 'IE', 'CY', 'MT', 'NO', 'IS', 'LI', 'CH'])

/**
 * Cosas del viaje que no son ropa, según el destino, la duración y el tiempo.
 * `paisDestino` y `paisOrigen` son códigos de dos letras (ES, FR...), si se saben.
 */
export function extrasDeViaje({ dias = [], paisDestino = null, paisOrigen = 'ES' } = {}) {
  const extras = ['Neceser', 'Cargador del móvil', 'Medicación personal']
  const fuera = Boolean(paisDestino) && paisDestino !== paisOrigen

  if (fuera && !UE.has(paisDestino)) extras.push('Pasaporte', 'Seguro de viaje')
  else if (fuera) extras.push('DNI o pasaporte')
  else extras.push('DNI')
  if (fuera && !ENCHUFE_EUROPEO.has(paisDestino)) extras.push('Adaptador de enchufe')

  const maximas = dias.map((d) => d.clima?.max ?? d.clima?.temp).filter((t) => typeof t === 'number')
  const minimas = dias.map((d) => d.clima?.min ?? d.clima?.temp).filter((t) => typeof t === 'number')
  if (dias.some((d) => d.clima?.lluvia)) extras.push('Paraguas plegable')
  if (dias.some((d) => d.ocasion === 'playa') || (maximas.length && Math.max(...maximas) >= 26)) {
    extras.push('Crema solar', 'Gafas de sol')
  }
  if (dias.some((d) => d.ocasion === 'playa')) extras.push('Bañador', 'Toalla de playa')
  if (minimas.length && Math.min(...minimas) <= 4) extras.push('Gorro, bufanda y guantes')
  if (dias.some((d) => d.ocasion === 'montaña')) extras.push('Botella de agua', 'Botiquín básico')
  if (dias.length >= 5) extras.push('Bolsa para la ropa sucia')
  if (dias.length >= 8) extras.push('Detergente de viaje')

  return extras
}
