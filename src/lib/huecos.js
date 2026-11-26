// Huecos del armario: la prenda que falta y que más combinaciones nuevas daría.
// Lógica pura. Reutiliza los huecos del maniquí y la armonía de «¿Qué me pongo hoy?»
// para no tener dos formas distintas de decidir si dos prendas combinan.

import { hexARgb, rgbAOklab } from './colores.js'
import { combinan } from './deseos.js'
import { esDelArmario } from './filtros.js'
import { huecoDe } from './sugerir.js'

const HUECOS = [
  { id: 'torso', sustantivo: 'una camiseta', forma: 'f' },
  { id: 'piernas', sustantivo: 'un pantalón', forma: 'm' },
  { id: 'pies', sustantivo: 'unos zapatos', forma: 'mp' },
  { id: 'abrigo', sustantivo: 'un abrigo', forma: 'm' },
]

// Colores básicos que completan casi cualquier armario. El hex sirve para la
// armonía de color; la concordancia, para que la frase se lea natural.
const BASICOS = [
  { id: 'blanco', hex: '#f3f3f1', formas: { f: 'blanca', m: 'blanco', mp: 'blancos' } },
  { id: 'negro', hex: '#17181b', formas: { f: 'negra', m: 'negro', mp: 'negros' } },
  { id: 'gris', hex: '#8a8d94', formas: { f: 'gris', m: 'gris', mp: 'grises' } },
  { id: 'beige', hex: '#cdbca0', formas: { f: 'beige', m: 'beige', mp: 'beige' } },
  { id: 'marino', hex: '#1e2a47', formas: { f: 'azul marino', m: 'azul marino', mp: 'azul marino' } },
  { id: 'vaquero', hex: '#4b6a88', formas: { f: 'vaquera', m: 'vaquero', mp: 'vaqueros' } },
]

const LIMITE = 3
const MISMO_COLOR = 0.08 // distancia en OKLab por debajo de la cual ya se tiene ese color

function distanciaColor(a, b) {
  const x = hexARgb(a)
  const y = hexARgb(b)
  if (!x || !y) return Infinity
  const p = rgbAOklab(...x)
  const q = rgbAOklab(...y)
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

/** ¿Ya hay una prenda de ese hueco en un color prácticamente igual? */
function yaLoTiene(lista, hex) {
  return lista.some((p) => (p.colores || []).some((c) => distanciaColor(c, hex) < MISMO_COLOR))
}

/**
 * Combinaciones que aparecen al añadir `nuevo`. Se cuentan igual que viste
 * «¿Qué me pongo hoy?»: arriba + abajo o vestido, con abrigo y calzado opcionales.
 */
function combinacionesCon(nuevo, porHueco) {
  const combina = (a, b) => combinan(a, b)
  const { torso, piernas, vestido, abrigo, pies } = porHueco
  let total = 0

  if (nuevo.hueco === 'pies') {
    for (const t of torso) {
      for (const b of piernas) {
        if (!combina(nuevo, t) || !combina(nuevo, b) || !combina(t, b)) continue
        total++
        for (const a of abrigo) if (combina(a, nuevo) && combina(a, t) && combina(a, b)) total++
      }
    }
    for (const d of vestido) {
      if (!combina(nuevo, d)) continue
      total++
      for (const a of abrigo) if (combina(a, nuevo) && combina(a, d)) total++
    }
  } else if (nuevo.hueco === 'abrigo') {
    for (const t of torso) {
      for (const b of piernas) {
        if (!combina(nuevo, t) || !combina(nuevo, b) || !combina(t, b)) continue
        total++
        for (const p of pies) if (combina(p, nuevo) && combina(p, t) && combina(p, b)) total++
      }
    }
    for (const d of vestido) {
      if (!combina(nuevo, d)) continue
      total++
      for (const p of pies) if (combina(p, nuevo) && combina(p, d)) total++
    }
  } else {
    // Arriba o abajo: la otra mitad manda; abrigo y calzado se suman si encajan.
    const pareja = nuevo.hueco === 'torso' ? piernas : torso
    for (const otra of pareja) {
      if (!combina(nuevo, otra)) continue
      total++
      const capas = abrigo.filter((a) => combina(a, nuevo) && combina(a, otra))
      const calzados = pies.filter((p) => combina(p, nuevo) && combina(p, otra))
      total += capas.length + calzados.length
      for (const a of capas) for (const p of calzados) if (combina(a, p)) total++
    }
  }

  return total
}

/**
 * Los huecos que más combinaciones nuevas darían, de mayor a menor ganancia.
 * Ignora archivadas, deseos y lo que ya está de salida. Devuelve como mucho
 * `limite` propuestas y ninguna con ganancia cero.
 */
export function huecosDelArmario(prendas, { limite = LIMITE } = {}) {
  const armario = prendas.filter((p) => esDelArmario(p) && !p.salida)
  if (armario.length < 2) return []

  const porHueco = { torso: [], piernas: [], vestido: [], abrigo: [], pies: [] }
  for (const p of armario) {
    const h = huecoDe(p)
    if (porHueco[h]) porHueco[h].push(p)
  }

  const propuestas = []
  for (const hueco of HUECOS) {
    for (const color of BASICOS) {
      if (yaLoTiene(porHueco[hueco.id], color.hex)) continue
      const nuevo = {
        id: `hueco-${hueco.id}-${color.id}`,
        nombre: `${hueco.sustantivo} ${color.formas[hueco.forma]}`,
        hueco: hueco.id,
        colores: [color.hex],
      }
      const ganancia = combinacionesCon(nuevo, porHueco)
      if (ganancia > 0) propuestas.push({ hueco: hueco.id, color: color.id, hex: color.hex, etiqueta: nuevo.nombre, ganancia })
    }
  }

  return propuestas.sort((a, b) => b.ganancia - a.ganancia).slice(0, limite)
}
