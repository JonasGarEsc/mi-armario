// Trae nombre, precio y foto de la página de una tienda mediante la función
// `leer-enlace`. Si la función no está desplegada o falla, devuelve null.

const ESPERA_MS = 15000
const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const EXTENSIONES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** base64 + tipo MIME → File, para que pase por el mismo flujo que una foto elegida. */
export function archivoDeBase64(base64, tipo) {
  if (!TIPOS.includes(tipo) || typeof base64 !== 'string' || !base64) return null
  try {
    const binario = atob(base64)
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0))
    if (!bytes.length) return null
    return new File([bytes], `enlace.${EXTENSIONES[tipo]}`, { type: tipo })
  } catch {
    return null
  }
}

function aPrecio(valor) {
  if (valor === null || valor === undefined || valor === '') return ''
  const numero = Number(String(valor).replace(',', '.'))
  return Number.isFinite(numero) && numero >= 0 && numero <= 1e8 ? Math.round(numero * 100) / 100 : ''
}

/** Limpia la respuesta de la función. Devuelve null si no hay nada que rellenar. */
export function datosDeEnlace(respuesta) {
  if (!respuesta || typeof respuesta !== 'object') return null
  const nombre = typeof respuesta.nombre === 'string'
    ? respuesta.nombre.replace(/\s+/g, ' ').trim().slice(0, 80)
    : ''
  const precio = aPrecio(respuesta.precio)
  const foto = archivoDeBase64(respuesta.imagen_base64, respuesta.tipo_mime)
  if (!nombre && precio === '' && !foto) return null
  return { nombre, precio, foto }
}

export async function traerDatosDeEnlace(supabase, url) {
  try {
    const respuesta = await Promise.race([
      supabase.functions.invoke('leer-enlace', { body: { url } }),
      new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('espera agotada')), ESPERA_MS)),
    ])
    if (respuesta.error || !respuesta.data) return null
    return datosDeEnlace(respuesta.data)
  } catch {
    return null
  }
}
