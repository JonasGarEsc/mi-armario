// Etiquetar las prendas que ya estaban en el armario (color en el móvil + visión con IA).

import { colorDeImagen } from './colores.js'
import { camposSinPisar, guardarEtiquetas, pedirEtiquetas } from './etiquetas.js'
import { rutaImagen, urlImagen } from './imagenes.js'

export const COLUMNAS_ETIQUETADO =
  'id, nombre, imagen_url, colores, familia_color, temporada, abrigo, formalidad, largo, estampado, precio, etiquetas_auto, archivada'

/** Prendas que aún no se han etiquetado: sin marca de origen y sin archivar. */
export const pendientesDeEtiquetar = (prendas) =>
  prendas.filter((p) => p.etiquetas_auto == null && !p.archivada)

/**
 * Etiqueta una prenda sin pisar lo que ya tiene ni lo editado a mano.
 * ok=false deja la prenda pendiente para reintentarla.
 */
export async function etiquetarPrenda(supabase, prenda) {
  const tieneColor = Array.isArray(prenda.colores) && prenda.colores.length > 0
  const [color, sugerencia] = await Promise.all([
    tieneColor ? null : urlImagen(prenda.imagen_url, 480).then((src) => (src ? colorDeImagen(src) : null)),
    pedirEtiquetas(supabase, { ruta: rutaImagen(prenda.imagen_url) }),
  ])
  if (!sugerencia && !color) return { ok: false }

  const campos = camposSinPisar(prenda, { ...(sugerencia?.etiquetas || {}), ...(color || {}) })
  // Sin respuesta de la IA, la prenda queda pendiente (solo se le ha puesto el color).
  if (sugerencia) campos.etiquetas_auto = true
  if (Object.keys(campos).length === 0) return { ok: true }

  return { ok: await guardarEtiquetas(supabase, prenda.id, campos) }
}
