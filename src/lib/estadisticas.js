// «Mi armario en números». Lógica pura: se prueba sin navegador y no toca la red.

import { estaOlvidada, diasSinUsar } from './filtros.js'

const TOP = 5
const SIN_INDICAR = 'Sin indicar'

export const numUsos = (prenda) => (prenda.usos || []).length

/** Reparte las prendas por una clave (o varias) y las cuenta, de más a menos. */
export function contarPor(prendas, claves) {
  const cuenta = new Map()
  for (const p of prendas) {
    const lista = claves(p)
    for (const c of lista.length ? lista : [SIN_INDICAR]) cuenta.set(c, (cuenta.get(c) || 0) + 1)
  }
  return [...cuenta.entries()]
    .map(([etiqueta, valor]) => ({ etiqueta, valor }))
    .sort((a, b) => b.valor - a.valor || a.etiqueta.localeCompare(b.etiqueta, 'es'))
}

/** Euros por uso. null si la prenda no tiene precio o aún no se ha puesto. */
export function costePorUso(prenda) {
  const usos = numUsos(prenda)
  if (typeof prenda.precio !== 'number' || usos === 0) return null
  return prenda.precio / usos
}

/**
 * Todo lo que enseña la pantalla. Las archivadas no cuentan (salvo para listarlas).
 * `hoy` es YYYY-MM-DD.
 */
export function estadisticasArmario(todas, hoy) {
  const archivadas = todas.filter((p) => p.archivada)
  const prendas = todas.filter((p) => !p.archivada)

  const porUsos = [...prendas].sort((a, b) => numUsos(b) - numUsos(a) || a.nombre.localeCompare(b.nombre, 'es'))
  const conUsos = porUsos.filter((p) => numUsos(p) > 0)

  // Las menos usadas: las que nunca se han puesto, y luego por pocos usos.
  const menosUsadas = [...prendas]
    .sort((a, b) => numUsos(a) - numUsos(b) || (a.creado_en || '').localeCompare(b.creado_en || ''))
    .slice(0, TOP)

  const conPrecio = prendas.filter((p) => typeof p.precio === 'number')
  const puestas = conPrecio.filter((p) => numUsos(p) > 0)
  const mejores = [...puestas].sort((a, b) => costePorUso(a) - costePorUso(b)).slice(0, TOP)
  // Las peores compras: las que ni se han puesto (el coste es infinito) y luego las más caras por uso.
  const peores = [
    ...conPrecio.filter((p) => numUsos(p) === 0).sort((a, b) => b.precio - a.precio),
    ...[...puestas].sort((a, b) => costePorUso(b) - costePorUso(a)),
  ].slice(0, TOP)

  const olvidadas = prendas
    .filter((p) => !p.salida && estaOlvidada(p, hoy))
    .map((p) => ({ prenda: p, dias: diasSinUsar(p, hoy) }))
    .sort((a, b) => (b.dias ?? Infinity) - (a.dias ?? Infinity) || a.prenda.nombre.localeCompare(b.prenda.nombre, 'es'))

  return {
    total: prendas.length,
    usosTotales: prendas.reduce((s, p) => s + numUsos(p), 0),
    inversion: Math.round(conPrecio.reduce((s, p) => s + p.precio, 0) * 100) / 100,
    conPrecio: conPrecio.length,
    masUsadas: conUsos.slice(0, TOP),
    menosUsadas,
    mejores,
    peores,
    olvidadas,
    paraSalir: prendas.filter((p) => p.salida),
    archivadas,
    porColor: contarPor(prendas, (p) => (p.familia_color ? [p.familia_color] : [])),
    porTipo: contarPor(prendas, (p) => (p.categorias?.tipos?.nombre ? [p.categorias.tipos.nombre] : [])),
    porTemporada: contarPor(prendas, (p) => p.temporada || []),
  }
}

/** «12,50 €» con la coma de España; sin decimales si son redondos. */
export function dinero(valor) {
  const redondo = Math.abs(valor - Math.round(valor)) < 0.005
  return `${valor.toLocaleString('es-ES', { minimumFractionDigits: redondo ? 0 : 2, maximumFractionDigits: 2 })} €`
}
