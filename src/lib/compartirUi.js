import { compartirImagen, compartirArchivo } from './exportar.js'
import { vibrar } from './vibrar.js'

/**
 * Comparte una imagen y avisa del resultado: abre el menú de compartir (o descarga si
 * el dispositivo no puede) y, si iOS lo niega por tardar, deja un botón «Compartir» listo.
 */
export async function compartirConAviso({ generar, nombre, titulo, mostrarToast }) {
  vibrar(30)
  try {
    const r = await compartirImagen(generar, nombre, titulo)
    if (r.estado === 'descargado') mostrarToast('Imagen descargada', 'exito')
    else if (r.estado === 'reintentar') {
      mostrarToast('Imagen lista', 'exito', {
        texto: 'Compartir',
        onClick: () => compartirArchivo(r.file, nombre).catch(() => mostrarToast('No se pudo compartir', 'error')),
      })
    } else if (r.estado === 'compartido') vibrar([30, 30])
  } catch {
    mostrarToast('No se pudo crear la imagen', 'error')
  }
}
