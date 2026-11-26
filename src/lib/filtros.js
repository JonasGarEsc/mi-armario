// Filtros de la galería del armario. Lógica pura: se prueba sin navegador.

import { FAMILIAS_COLOR } from './colores.js'
import { TEMPORADAS } from './etiquetas.js'

export const GRUPOS_FORMALIDAD = [
  { id: 'casual', etiqueta: 'Casual', niveles: [1, 2] },
  { id: 'arreglado', etiqueta: 'Arreglado', niveles: [3] },
  { id: 'elegante', etiqueta: 'Elegante', niveles: [4, 5] },
]

export const DIAS_SIN_USAR = 90

export { FAMILIAS_COLOR, TEMPORADAS }

/** ¿Es una prenda que tienes y se ve en el armario? (ni archivada ni de la lista de deseos) */
export const esDelArmario = (p) => !p.archivada && !p.deseada

const MS_DIA = 86_400_000

/** Última fecha (YYYY-MM-DD) en que se usó la prenda, o null. */
export function ultimaVez(prenda) {
  const fechas = (prenda.usos || []).map((u) => u.fecha).filter(Boolean).sort()
  return fechas.length ? fechas[fechas.length - 1] : null
}

const aDia = (iso) => Date.UTC(...iso.split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))))

/** Días desde el último uso hasta `hoy` (YYYY-MM-DD). null si nunca se ha usado. */
export function diasSinUsar(prenda, hoy) {
  const ultima = ultimaVez(prenda)
  if (!ultima) return null
  return Math.floor((aDia(hoy) - aDia(ultima)) / MS_DIA)
}

/**
 * ¿Lleva la prenda 90 días o más sin usarse? Si nunca se ha usado, cuenta desde
 * que se añadió (así una prenda recién comprada no sale como olvidada).
 */
export function estaOlvidada(prenda, hoy, dias = DIAS_SIN_USAR) {
  const d = diasSinUsar(prenda, hoy)
  if (d !== null) return d >= dias
  if (!prenda.creado_en) return true
  return Math.floor((aDia(hoy) - aDia(String(prenda.creado_en).slice(0, 10))) / MS_DIA) >= dias
}

export const sinFiltros = { familia: '', temporada: '', formalidad: '', olvidadas: false }

export const hayFiltros = (f) => Boolean(f.familia || f.temporada || f.formalidad || f.olvidadas)

/** Aplica búsqueda, categoría y los filtros de etiquetas. Ni archivadas ni deseadas salen. */
export function filtrarPrendas(prendas, { busqueda = '', categoriaId = null, filtros = sinFiltros, hoy } = {}) {
  const term = busqueda.toLowerCase()
  const grupo = GRUPOS_FORMALIDAD.find((g) => g.id === filtros.formalidad)

  return prendas.filter((p) => {
    if (!esDelArmario(p)) return false
    if (term && !(`${p.nombre || ''}`.toLowerCase().includes(term) || `${p.categorias?.nombre || ''}`.toLowerCase().includes(term))) return false
    if (categoriaId && p.categoria_id !== categoriaId) return false
    if (filtros.familia && p.familia_color !== filtros.familia) return false
    if (filtros.temporada && !(p.temporada || []).includes(filtros.temporada)) return false
    if (grupo && !grupo.niveles.includes(p.formalidad)) return false
    if (filtros.olvidadas && !estaOlvidada(p, hoy)) return false
    return true
  })
}
