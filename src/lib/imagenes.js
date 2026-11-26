import { supabase } from '../supabase'
import { elegirUrl, fotoSinUso } from './urlFoto'

// Las fotos viven en el bucket privado «prendas». Guardamos en la base la URL
// canónica de getPublicUrl, pero para mostrarla pedimos una URL firmada.

const PREFIJO = 'armario_firma_v3_'
const memoria = new Map()
const pendientes = new Map()
const SIETE_DIAS = 60 * 60 * 24 * 7
const SEIS_DIAS = 60 * 60 * 24 * 6

/** De cualquier URL de Supabase saca la ruta dentro del bucket. */
export function rutaImagen(url) {
  if (!url || typeof url !== 'string') return null
  const limpia = url.split('?')[0].split('#')[0]
  const marca = '/prendas/'
  const i = limpia.indexOf(marca)
  if (i === -1) return limpia.replace(/^\/+/, '') || null
  try {
    return decodeURIComponent(limpia.slice(i + marca.length))
  } catch {
    return limpia.slice(i + marca.length)
  }
}

function leerFirma(clave, { caducada = false } = {}) {
  try {
    const guardada = JSON.parse(localStorage.getItem(PREFIJO + clave))
    if (guardada?.url && (caducada || guardada.expira > Date.now())) return guardada
  } catch {
    // localStorage lleno o modo privado: seguimos solo con memoria.
  }
  return null
}

function guardarFirma(clave, valor) {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor))
  } catch {
    // Sin espacio: la memoria basta para esta sesión.
  }
}

/**
 * URL firmada (7 días) con miniatura redimensionada.
 * Si el plan de Supabase no tiene transformaciones, cae a la URL firmada simple
 * y, si tampoco hay forma, a la URL guardada.
 */
export async function urlImagen(url, ancho = 480, forzar = false) {
  const ruta = rutaImagen(url)
  if (!ruta) return url || null

  const clave = `${ruta}@${ancho}`
  const ahora = Date.now()

  if (!forzar) {
    const enMemoria = memoria.get(clave)
    if (enMemoria && enMemoria.expira > ahora) return enMemoria.url
    const enDisco = leerFirma(clave)
    if (enDisco) {
      memoria.set(clave, enDisco)
      return enDisco.url
    }
    if (pendientes.has(clave)) return pendientes.get(clave)
  }

  const tarea = (async () => {
    const conTransformacion = await supabase.storage
      .from('prendas')
      .createSignedUrl(ruta, SIETE_DIAS, { transform: { width: ancho, quality: 70 } })

    if (!conTransformacion.error && conTransformacion.data?.signedUrl) {
      return conTransformacion.data.signedUrl
    }

    const simple = await supabase.storage.from('prendas').createSignedUrl(ruta, SIETE_DIAS)
    return simple.data?.signedUrl || null
  })()
    .then((firmada) => {
      pendientes.delete(clave)
      if (!firmada) return elegirUrl(null, leerFirma(clave, { caducada: true })?.url, url)
      const valor = { url: firmada, expira: ahora + SEIS_DIAS * 1000 }
      memoria.set(clave, valor)
      guardarFirma(clave, valor)
      return firmada
    })
    .catch(() => {
      pendientes.delete(clave)
      return elegirUrl(null, leerFirma(clave, { caducada: true })?.url, url)
    })

  pendientes.set(clave, tarea)
  return tarea
}

export function olvidarImagen(url) {
  const ruta = rutaImagen(url)
  if (!ruta) return
  for (const clave of [...memoria.keys()]) {
    if (!clave.startsWith(`${ruta}@`)) continue
    memoria.delete(clave)
    try {
      localStorage.removeItem(PREFIJO + clave)
    } catch {
      // da igual
    }
  }
}

/** Borra el archivo del bucket a partir de su URL. */
export async function borrarArchivo(url) {
  const ruta = rutaImagen(url)
  if (!ruta) return
  // Una copia restaurada comparte foto con la original.
  if (!(await fotoSinUso(supabase, url))) return
  await supabase.storage.from('prendas').remove([ruta])
  olvidarImagen(url)
}
