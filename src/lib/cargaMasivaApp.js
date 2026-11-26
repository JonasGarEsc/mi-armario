// La cola de subida masiva de la app: una sola para toda la sesión, así sigue trabajando
// aunque cierres la hoja. Aquí se conectan los pasos reales (comprimir y recortar,
// colores, IA, subir y guardar). La lógica de la cola está en cargaMasiva.js.

import { useSyncExternalStore } from 'react'
import { supabase } from '../supabase'
import { crearCargaMasiva } from './cargaMasiva'
import { procesarEnCola } from './cola'
import { colorDeImagen } from './colores'
import {
  etiquetasDeFormulario, etiquetasParaGuardar, hayEtiquetas, insertarPrenda, origenEtiquetas, pedirEtiquetas,
} from './etiquetas'
import { borrarArchivo } from './imagenes'
import { prepararFoto, subirFoto } from './imagen'

export const cargaMasiva = crearCargaMasiva({
  pasos: {
    preparar: (archivo, opciones) => prepararFoto(archivo, opciones),
    analizar: async (foto) => {
      const [color, sugerencia] = await Promise.all([colorDeImagen(foto), pedirEtiquetas(supabase, { foto })])
      return { color, sugerencia }
    },
    vistaPrevia: (foto) => URL.createObjectURL(foto),
    liberar: (url) => URL.revokeObjectURL(url),
  },
})

/** Las fotos de la cola, siempre al día. */
export function useCargaMasiva() {
  return useSyncExternalStore(cargaMasiva.suscribir, cargaMasiva.obtener)
}

/** ¿Está lista para guardarse? Necesita nombre y categoría. */
export const sePuedeGuardar = (item) => item.estado === 'lista' && item.nombre.trim() !== '' && item.categoriaId !== ''

/**
 * Sube y guarda las fotos revisadas (3 a la vez). Las que salen bien dejan la cola;
 * las que fallan siguen ahí con su error para reintentar. Devuelve { guardadas, fallos }.
 */
export async function guardarRevisadas(items = cargaMasiva.obtener()) {
  const aGuardar = items.filter(sePuedeGuardar)
  const hechas = []

  await procesarEnCola(aGuardar, async (item) => {
    let subida = null
    try {
      subida = await subirFoto(item.foto)
      const etiquetas = etiquetasParaGuardar(etiquetasDeFormulario({ ...(item.sugerencia?.etiquetas || {}), ...(item.color || {}) }))
      const error = await insertarPrenda(
        supabase,
        { nombre: item.nombre.trim(), imagen_url: subida.url, categoria_id: item.categoriaId },
        { ...etiquetas, etiquetas_auto: origenEtiquetas({ sugeridaPorIA: hayEtiquetas(item.sugerencia?.etiquetas), editadas: false }) },
      )
      if (error) throw new Error('No se pudo guardar en la base de datos.')
      hechas.push(item.id)
      return true
    } catch (e) {
      // La foto no se queda huérfana en el bucket si la fila no llegó a guardarse.
      if (subida) await borrarArchivo(subida.url)
      cargaMasiva.editar(item.id, { estado: 'error', mensaje: e.message || 'No se pudo guardar.' })
      return false
    }
  }, { concurrencia: 3 })

  cargaMasiva.quitar(hechas)
  return { guardadas: hechas.length, fallos: aGuardar.length - hechas.length }
}
