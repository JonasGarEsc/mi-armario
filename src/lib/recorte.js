// Caja visible de una foto con transparencia y encaje en un hueco.
// Sirve para que la ropa tape el cuerpo aunque la foto tenga aire alrededor.

const PREFIJO = 'armario_caja_v1_'
const memoria = new Map()
const pendientes = new Map()

function leer(clave) {
  if (memoria.has(clave)) return memoria.get(clave)
  try {
    if (typeof localStorage === 'undefined') return undefined
    const crudo = localStorage.getItem(PREFIJO + clave)
    if (crudo === null) return undefined
    const valor = JSON.parse(crudo)
    memoria.set(clave, valor)
    return valor
  } catch {
    return undefined
  }
}

function guardar(clave, caja) {
  memoria.set(clave, caja)
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PREFIJO + clave, JSON.stringify(caja))
    }
  } catch {
    // Sin espacio: la memoria basta para esta sesión.
  }
}

function medir(src) {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      resolve(null)
      return
    }

    let terminado = false
    const acabar = (valor) => {
      if (terminado) return
      terminado = true
      clearTimeout(reloj)
      resolve(valor)
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    const reloj = setTimeout(() => acabar(null), 12000)

    img.onload = () => {
      try {
        const MAX = 240
        const anchoNatural = img.naturalWidth || 1
        const altoNatural = img.naturalHeight || 1
        const escala = Math.min(1, MAX / Math.max(anchoNatural, altoNatural))
        const w = Math.max(1, Math.round(anchoNatural * escala))
        const h = Math.max(1, Math.round(altoNatural * escala))

        const lienzo = document.createElement('canvas')
        lienzo.width = w
        lienzo.height = h
        const ctx = lienzo.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          acabar(null)
          return
        }

        ctx.drawImage(img, 0, 0, w, h)
        const datos = ctx.getImageData(0, 0, w, h).data
        let minX = w
        let minY = h
        let maxX = -1
        let maxY = -1

        for (let y = 0; y < h; y++) {
          const fila = y * w * 4
          for (let x = 0; x < w; x++) {
            if (datos[fila + x * 4 + 3] > 16) {
              if (x < minX) minX = x
              if (x > maxX) maxX = x
              if (y < minY) minY = y
              if (y > maxY) maxY = y
            }
          }
        }

        if (maxX < minX || maxY < minY) {
          acabar(null)
          return
        }

        const caja = {
          x: minX / w,
          y: minY / h,
          w: (maxX - minX + 1) / w,
          h: (maxY - minY + 1) / h,
          relacion: anchoNatural / altoNatural,
        }

        // Si no hay márgenes que recortar, no merece la pena.
        acabar(caja.w > 0.985 && caja.h > 0.985 ? null : caja)
      } catch {
        // Canvas contaminado por CORS o sin soporte: se usa el modo de respaldo.
        acabar(null)
      }
    }

    img.onerror = () => acabar(null)
    img.src = src
  })
}

/**
 * Devuelve la caja visible de la imagen (fracciones de 0 a 1) o null.
 * Se guarda en memoria y en localStorage para no repetir el escaneo.
 */
export async function cajaVisible(src, clave) {
  if (!src) return null
  const llave = clave || src.split('?')[0]
  const guardada = leer(llave)
  if (guardada !== undefined) return guardada
  if (pendientes.has(llave)) return pendientes.get(llave)

  const tarea = medir(src).then((caja) => {
    guardar(llave, caja)
    pendientes.delete(llave)
    return caja
  })

  pendientes.set(llave, tarea)
  return tarea
}

/**
 * Coloca la imagen para que su caja visible cubra el objetivo.
 * `aspecto` es ancho/alto del contenedor y `objetivo` es la zona del
 * contenedor que hay que tapar (fracciones de 0 a 1, relativa al hueco).
 * Devuelve porcentajes respecto al ancho y alto del contenedor.
 */
export function encajarCaja(caja, aspecto = 1, objetivo = null, margen = 1.03) {
  if (!caja || !(caja.w > 0) || !(caja.h > 0) || !(aspecto > 0)) return null

  const relacion = caja.relacion > 0 ? caja.relacion : 1
  const altoContenedor = 1 / aspecto // con ancho de contenedor = 1
  const zona = objetivo && objetivo.w > 0 && objetivo.h > 0
    ? objetivo
    : { x: 0, y: 0, w: 1, h: 1 }

  const anchoObjetivo = zona.w
  const altoObjetivo = zona.h * altoContenedor
  const centroX = zona.x + zona.w / 2
  const centroY = (zona.y + zona.h / 2) * altoContenedor

  // Ancho de la imagen completa para que la caja visible cubra el objetivo.
  const anchoImagen = Math.max(
    anchoObjetivo / caja.w,
    (altoObjetivo * relacion) / caja.h,
  ) * margen
  const altoImagen = anchoImagen / relacion

  const izquierda = centroX - (caja.w * anchoImagen) / 2 - caja.x * anchoImagen
  const arriba = centroY - (caja.h * altoImagen) / 2 - caja.y * altoImagen

  return {
    ancho: anchoImagen * 100,
    alto: (altoImagen / altoContenedor) * 100,
    izquierda: izquierda * 100,
    arriba: (arriba / altoContenedor) * 100,
  }
}
