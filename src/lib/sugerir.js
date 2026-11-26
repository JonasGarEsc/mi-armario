// «¿Qué me pongo hoy?»: propone outfits completos con el tiempo, la rotación y el color.
// Lógica pura (sin red ni interfaz) para poder probarla y para que sea rápida:
// primero se descartan prendas que no valen hoy, se queda uno con las mejores de
// cada hueco del cuerpo y solo entonces se combinan y puntúan.

import { oklchDeHex, familiaDeColor } from './colores.js'
import { diasSinUsar } from './filtros.js'
import { inferirRanura } from './maniqui.js'
import { claveCombinacion } from './outfits.js'

/** Objetivo de formalidad (1-5) de cada ocasión; null = sin preferencia. */
export const OCASIONES = {
  cualquiera: { etiqueta: 'Cualquiera', objetivo: null },
  casa: { etiqueta: 'Casa', objetivo: 1.5 },
  trabajo: { etiqueta: 'Trabajo', objetivo: 3 },
  cena: { etiqueta: 'Cena', objetivo: 3.5 },
  deporte: { etiqueta: 'Deporte', objetivo: 1 },
}

/** Ocasiones de un viaje: cada día de la maleta puede tener la suya. */
export const OCASIONES_VIAJE = {
  ciudad: { etiqueta: 'Ciudad', objetivo: 2.5 },
  playa: { etiqueta: 'Playa', objetivo: 1 },
  cena: { etiqueta: 'Cena', objetivo: 3.5 },
  montaña: { etiqueta: 'Montaña', objetivo: 1.5 },
}

const PODA = 10 // prendas que pasan a combinarse por hueco
const DIAS_DESCANSO = 3 // una prenda usada hace menos de 3 días no se propone
const ABIERTO = /sandalia|chancla|alpargata|zueco|cangrejera|ojotas/i
const PUNTOS_ME_GUSTA = 2 // lo que sube un outfit que te ha gustado

/** Temporada que corresponde a una temperatura sentida. */
export function temporadaDeTemperatura(t) {
  if (t >= 24) return 'verano'
  if (t <= 12) return 'invierno'
  return 'entretiempo'
}

/** Nivel de abrigo (1-5) que debería llevar el conjunto con esa temperatura sentida. */
export function nivelAbrigoObjetivo(t) {
  if (t >= 28) return 1
  if (t >= 23) return 1.5
  if (t >= 18) return 2
  if (t >= 13) return 3
  if (t >= 8) return 4
  return 5
}

/** Hueco del cuerpo de una prenda (torso, piernas, vestido, abrigo, pies...) o null. */
export function huecoDe(prenda) {
  return inferirRanura(prenda.categorias?.nombre, prenda.categorias?.tipos?.nombre, prenda.nombre)
}

// Tono y familia de cada prenda, calculados una vez (parsear el hex es lo más caro).
const metaColor = new WeakMap()
function colorDe(p) {
  let m = metaColor.get(p)
  if (m === undefined) {
    const hex = p.colores?.[0]
    const lch = hex ? oklchDeHex(hex) : null
    m = lch ? { h: lch.h, familia: p.familia_color || familiaDeColor(hex) } : null
    metaColor.set(p, m)
  }
  return m
}

/** Cómo combinan dos colores (de -2 a 1). Sin colores conocidos, 0. */
export function armonia(a, b) {
  const A = colorDe(a)
  const B = colorDe(b)
  if (!A || !B) return 0
  if (A.familia === 'neutro' || B.familia === 'neutro') return 1
  let d = Math.abs(A.h - B.h)
  if (d > 180) d = 360 - d
  const vivos = A.familia === 'vivo' && B.familia === 'vivo'
  if (d < 30) return vivos ? 0.2 : 0.9 // mismo tono
  if (d < 60) return vivos ? -0.5 : 0.4 // tonos vecinos
  if (d >= 150) return vivos ? -0.8 : 0.5 // complementarios
  return vivos ? -2 : -0.6 // choque
}

/** Puntuación de una prenda sola: rotación, temporada, lluvia y ocasión. */
function puntuarPrenda(p, ctx) {
  let punto = 0
  const dias = diasSinUsar(p, ctx.hoy)
  punto += dias === null ? 2 : Math.min(dias, 60) / 30 // lo que lleva más tiempo parado sube

  if (p.temporada?.length) {
    if (p.temporada.includes(ctx.temporada)) punto += 1
    else if (!(ctx.temporada === 'entretiempo' || p.temporada.includes('entretiempo'))) punto -= 3
    else punto -= 0.5
  }
  if (ctx.lluvia && ABIERTO.test(p.nombre || '')) punto -= 3

  if (ctx.objetivoFormalidad != null && p.formalidad) punto -= Math.abs(p.formalidad - ctx.objetivoFormalidad) * 0.7
  return punto
}

const clave = (ids) => [...ids].sort().join('|')

/** ¿Se diferencian dos outfits en al menos `minimo` prendas? */
export function sonDistintos(a, b, minimo = 2) {
  const enB = new Set(b)
  return a.filter((id) => !enB.has(id)).length >= minimo
}

function puntuarConjunto(piezas, base, ctx) {
  const { torso, piernas, vestido, abrigo, pies } = piezas
  const lista = [torso, piernas, vestido, abrigo, pies].filter(Boolean)
  let total = lista.reduce((s, p) => s + base.get(p.id), 0) / lista.length

  // Clima: el abrigo del conjunto frente al que pide la temperatura.
  const principal = vestido || torso
  const capa = principal?.abrigo ?? 2.5
  const calidez = abrigo ? Math.max(capa, abrigo.abrigo ?? 3) + 0.5 : capa
  total -= Math.abs(calidez - ctx.objetivoAbrigo) * 2
  if (ctx.frio && !abrigo) total -= 1

  // Color: cada pareja de piezas contribuye por igual.
  let parejas = 0
  let color = 0
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) { color += armonia(lista[i], lista[j]); parejas++ }
  }
  if (parejas) total += (color / parejas) * 2.5

  // Estampados: un conjunto lleva uno como mucho.
  const estampados = lista.map((p) => p.estampado).filter((e) => e && e !== 'liso')
  if (estampados.length > 1) total -= new Set(estampados).size > 1 ? 3 : 1

  // Formalidad: las piezas no deberían distar más de un nivel.
  const niveles = lista.map((p) => p.formalidad).filter(Boolean)
  if (niveles.length > 1) total -= Math.max(0, Math.max(...niveles) - Math.min(...niveles) - 1) * 2

  return total
}

/**
 * Propone hasta `n` outfits distintos entre sí (al menos 2 prendas de diferencia).
 *
 * `prendas`: con categorías, usos y etiquetas.
 * `clima`: { temp (sensación, °C), lluvia (bool) }.
 * `fijadas`: ids que deben llevar todos los outfits.
 * `descartar`: claves de outfits que no se repiten; `mantener`: outfits (listas de
 * ids) ya elegidos, de los que los nuevos tienen que diferenciarse.
 * `bonus`: Map id → puntos extra o de penalización (la maleta lo usa para reutilizar
 * prendas). `minimoDiferencia`: prendas que han de distinguir a dos outfits (2 por
 * defecto, 1 para la maleta). `descanso`: días que una prenda reposa tras usarse.
 * `requerir`: { pies, abrigo } — huecos que el outfit debe llevar sí o sí.
 * `valoraciones`: Map claveCombinacion → 1 | -1. El -1 no se propone y el 1 sube.
 */
export function sugerirOutfits(prendas, {
  clima, hoy, ocasion = 'cualquiera', fijadas = [], n = 3, descartar = [], mantener = [],
  bonus = null, minimoDiferencia = 2, descanso = DIAS_DESCANSO, requerir = {}, valoraciones = null,
}) {
  const ctx = {
    hoy,
    temporada: temporadaDeTemperatura(clima.temp),
    lluvia: Boolean(clima.lluvia),
    objetivoAbrigo: nivelAbrigoObjetivo(clima.temp),
    frio: clima.temp < 16,
    objetivoFormalidad: (OCASIONES[ocasion] ?? OCASIONES_VIAJE[ocasion])?.objetivo ?? null,
  }
  const fijas = new Set(fijadas)
  const evitar = new Set(descartar)

  // 1. Reparto por huecos del cuerpo, quitando lo que no se puede poner hoy.
  const huecos = { torso: [], piernas: [], vestido: [], abrigo: [], pies: [] }
  const base = new Map()
  for (const p of prendas) {
    if (p.archivada || p.salida || (p.deseada && !fijas.has(p.id))) continue
    const hueco = huecoDe(p)
    if (!huecos[hueco]) continue
    const fijada = fijas.has(p.id)
    const dias = diasSinUsar(p, hoy)
    if (!fijada && descanso > 0 && dias !== null && dias < descanso) continue
    base.set(p.id, puntuarPrenda(p, ctx) + (fijada ? 100 : 0) + (bonus?.get(p.id) ?? 0))
    huecos[hueco].push(p)
  }

  // 2. Poda: las mejores de cada hueco (las fijadas siempre pasan).
  const mejores = (lista) => lista.sort((a, b) => base.get(b.id) - base.get(a.id)).slice(0, PODA)
  for (const h of Object.keys(huecos)) huecos[h] = mejores(huecos[h])

  // Una prenda fijada manda en su hueco: es la única opción.
  const unica = (hueco) => {
    const f = huecos[hueco].find((p) => fijas.has(p.id))
    return f ? [f] : huecos[hueco]
  }
  const tops = unica('torso')
  const bajos = unica('piernas')
  const vestidos = unica('vestido')
  const capasPosibles = unica('abrigo')
  const calzados = huecos.pies.length ? unica('pies') : [null]

  const hayCapaFijada = capasPosibles.some((p) => fijas.has(p.id))
  const capas = ctx.frio || hayCapaFijada
    ? (hayCapaFijada ? capasPosibles : [null, ...capasPosibles])
    : [null]

  // Si se ha fijado un vestido, no hay torso ni piernas; y al revés.
  const fijoTorsoOPiernas = [...tops, ...bajos].some((p) => fijas.has(p.id))
  const fijoVestido = vestidos.some((p) => fijas.has(p.id))

  // 3. Combinar y puntuar.
  const candidatos = []
  const anadir = (piezas) => {
    const ids = Object.values(piezas).filter(Boolean).map((p) => p.id)
    if (evitar.has(clave(ids))) return
    if ((requerir.pies && !piezas.pies) || (requerir.abrigo && !piezas.abrigo)) return
    const valoracion = valoraciones?.get(claveCombinacion(ids)) ?? 0
    if (valoracion === -1) return
    candidatos.push({
      ids,
      piezas,
      puntuacion: puntuarConjunto(piezas, base, ctx) + (valoracion === 1 ? PUNTOS_ME_GUSTA : 0),
    })
  }

  for (const pies of calzados) {
    for (const abrigo of capas) {
      if (!fijoVestido) for (const torso of tops) for (const piernas of bajos) anadir({ torso, piernas, vestido: null, abrigo, pies })
      if (!fijoTorsoOPiernas) for (const vestido of vestidos) anadir({ torso: null, piernas: null, vestido, abrigo, pies })
    }
  }

  // 4. Elegir los mejores que se diferencien entre sí (y de los que ya hay).
  candidatos.sort((a, b) => b.puntuacion - a.puntuacion)
  const elegidos = []
  for (const c of candidatos) {
    if (elegidos.length >= n) break
    if (mantener.some((ids) => !sonDistintos(c.ids, ids, minimoDiferencia))) continue
    if (elegidos.some((e) => !sonDistintos(c.ids, e.ids, minimoDiferencia))) continue
    elegidos.push(c)
  }
  return elegidos.map((c) => ({ ...c, clave: clave(c.ids) }))
}
