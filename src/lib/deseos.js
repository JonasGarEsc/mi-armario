// Lista de deseos: cuánto combina algo que aún no tienes con lo que ya tienes.
// Lógica pura. Usa la misma armonía de color que «¿Qué me pongo hoy?».

import { esDelArmario } from './filtros.js'
import { armonia, huecoDe } from './sugerir.js'

/** Con qué huecos del cuerpo se combina cada prenda. */
export const COMPLEMENTARIOS = {
  torso: ['piernas'],
  piernas: ['torso'],
  vestido: ['abrigo', 'pies'],
  abrigo: ['torso', 'piernas', 'vestido'],
  pies: ['torso', 'piernas', 'vestido'],
}

const MINIMO_ARMONIA = 0.3

function temporadasCompatibles(a, b) {
  if (!a.temporada?.length || !b.temporada?.length) return true
  if (a.temporada.includes('entretiempo') || b.temporada.includes('entretiempo')) return true
  return a.temporada.some((t) => b.temporada.includes(t))
}

/**
 * ¿Quedan bien juntas? El color pasa si se conoce y armoniza (o si falta en alguna: se le
 * da el beneficio de la duda); la formalidad no puede distar más de un nivel, y no se
 * mezclan prendas de temporadas opuestas.
 */
export function combinan(a, b) {
  const sinColor = !a.colores?.[0] || !b.colores?.[0]
  if (!sinColor && armonia(a, b) < MINIMO_ARMONIA) return false
  if (a.formalidad && b.formalidad && Math.abs(a.formalidad - b.formalidad) > 1) return false
  return temporadasCompatibles(a, b)
}

/** Las prendas del armario con las que combina un deseo. */
export function combinaCon(deseo, armario) {
  const hueco = huecoDe(deseo)
  const parejas = COMPLEMENTARIOS[hueco]
  if (!parejas) return []
  return armario.filter((p) => esDelArmario(p) && !p.salida && parejas.includes(huecoDe(p)) && combinan(deseo, p))
}

/** El mismo cálculo para toda la lista, con el recuento de cada deseo. */
export function resumenDeseos(deseos, armario) {
  const propias = armario.filter((p) => esDelArmario(p))
  return deseos.map((d) => ({ deseo: d, hueco: huecoDe(d), combina: combinaCon(d, propias) }))
}
