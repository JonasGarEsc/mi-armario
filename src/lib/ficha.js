// Ficha de una prenda: lo que resume su uso y los outfits que la contienen.
// Lo puro se prueba sin navegador; la consulta recibe el cliente por parámetro.

import { costePorUso, numUsos } from './estadisticas.js'
import { NIVELES_ABRIGO, NIVELES_FORMALIDAD } from './etiquetas.js'
import { ultimaVez } from './filtros.js'

const capital = (texto) => (texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : '')

/** Usos, último uso, precio y coste por uso. Sin precio, ni precio ni coste. */
export function resumenFicha(prenda) {
  const usos = numUsos(prenda)
  const precio = typeof prenda?.precio === 'number' && Number.isFinite(prenda.precio) ? prenda.precio : null
  return {
    usos,
    ultima: ultimaVez(prenda),
    precio,
    coste: precio === null ? null : costePorUso(prenda),
    sinEstrenar: usos === 0,
  }
}

/** «Sin estrenar», «1 vez», «7 veces». */
export function textoUsos(usos) {
  if (!usos) return 'Sin estrenar'
  return usos === 1 ? '1 vez' : `${usos} veces`
}

/** Nivel 1-5 → su etiqueta; cualquier otra cosa se descarta. */
function nivel(valor, etiquetas) {
  const n = Math.round(Number(valor))
  return Number.isFinite(n) && n >= 1 && n <= etiquetas.length ? etiquetas[n - 1] : null
}

/** Etiquetas legibles de la prenda, sin repetir y sin huecos. */
export function etiquetasDePrenda(prenda) {
  const lista = []
  const anadir = (valor) => {
    if (valor && !lista.includes(valor)) lista.push(valor)
  }

  anadir(prenda?.categorias?.tipos?.nombre)
  anadir(prenda?.categorias?.nombre)
  anadir(capital(prenda?.familia_color))
  const temporadas = Array.isArray(prenda?.temporada) ? prenda.temporada : [prenda?.temporada]
  for (const temporada of temporadas) anadir(capital(temporada))
  anadir(nivel(prenda?.abrigo, NIVELES_ABRIGO))
  anadir(nivel(prenda?.formalidad, NIVELES_FORMALIDAD))
  anadir(capital(prenda?.largo))
  anadir(capital(prenda?.estampado))
  if (prenda?.salida) anadir(prenda.salida === 'donar' ? 'Para donar' : 'Para vender')

  return lista
}

// La consulta completa trae las piezas tal como se guardaron (posición, capa,
// ranura). Si la base es antigua, se reintenta con lo mínimo para pintarlas.
export const CONSULTA_OUTFITS = 'conjunto_id, conjuntos(id, nombre, conjunto_prenda(*, prendas(*, categorias(nombre, tipos(nombre)))))'
export const CONSULTA_OUTFITS_BASICA = 'conjunto_id, conjuntos(id, nombre, conjunto_prenda(prenda_id, prendas(imagen_url)))'

/** Outfits que contienen la prenda, sin repetir si sale en varias filas. */
export async function consultarOutfitsDePrenda(supabase, prendaId) {
  if (!supabase || !prendaId) return []

  try {
    let { data } = await supabase.from('conjunto_prenda').select(CONSULTA_OUTFITS).eq('prenda_id', prendaId)
    if (!data) {
      ;({ data } = await supabase.from('conjunto_prenda').select(CONSULTA_OUTFITS_BASICA).eq('prenda_id', prendaId))
    }

    const vistos = new Map()
    for (const fila of data || []) {
      const conjunto = fila?.conjuntos
      if (conjunto?.id && !vistos.has(conjunto.id)) vistos.set(conjunto.id, conjunto)
    }
    return [...vistos.values()]
  } catch {
    return []
  }
}
