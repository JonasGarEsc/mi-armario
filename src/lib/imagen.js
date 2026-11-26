import { supabase } from '../supabase'

// 900 px sobra: la rejilla pinta a 150 y el lienzo del outfit a 130.
// useWebWorker en false evita cuelgues en Safari iOS al comprimir.
const OPCIONES = { maxSizeMB: 0.25, maxWidthOrHeight: 900, useWebWorker: false, fileType: 'image/webp' }

/**
 * Comprime (y, si se pide, recorta el fondo) antes de subir.
 * Tanto la compresión como la IA se cargan solo al usarlas.
 */
export async function prepararFoto(archivoOriginal, { quitarFondo = false, onEstado = () => {} } = {}) {
  onEstado('Comprimiendo imagen…')
  const { default: imageCompression } = await import('browser-image-compression')
  let procesado = await imageCompression(archivoOriginal, OPCIONES)

  if (quitarFondo) {
    onEstado('Recortando fondo (IA)…')
    // Sin publicPath: la librería usa el CDN de su propia versión.
    const { removeBackground } = await import('@imgly/background-removal')
    const blobSinFondo = await removeBackground(procesado)
    const recorte = new File([blobSinFondo], 'recorte.png', { type: 'image/png' })
    onEstado('Comprimiendo recorte…')
    try {
      procesado = await imageCompression(recorte, OPCIONES)
    } catch {
      procesado = recorte
    }
  }

  return procesado
}

/** Sube la foto a `<uuid>/prenda-<marca>-<azar>.<ext>` y devuelve URL y ruta. */
export async function subirFoto(archivo, { onEstado = () => {} } = {}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sesión caducada. Vuelve a entrar.')

  const extension = archivo.type === 'image/png' ? 'png' : 'webp'
  const azar = Math.random().toString(36).slice(2, 8)
  const ruta = `${user.id}/prenda-${Date.now()}-${azar}.${extension}`

  onEstado('Subiendo al servidor…')
  const { error } = await supabase.storage.from('prendas').upload(ruta, archivo)
  if (error) throw new Error('Error al subir imagen. Revisa tu conexión.')

  const { data: { publicUrl } } = supabase.storage.from('prendas').getPublicUrl(ruta)
  return { ruta, url: publicUrl }
}
