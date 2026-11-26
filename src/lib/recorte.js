// Caja visible de una foto con transparencia y perfil de anchuras.
// Sirve para vestir el maniquí aunque la foto tenga aire alrededor.

const PREFIJO = 'armario_caja_v2_'
const OPACO = 64 // alfa mínimo para contar un píxel (ignora sombras suaves)
const FILAS_PERFIL = 40
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

/**
 * Para FILAS_PERFIL alturas de la prenda, la anchura del tramo opaco que pasa
 * por su centro (fracción del ancho de la foto). Así se distingue el cuerpo
 * de una camiseta de sus mangas, o la cinturilla de un pantalón de su vuelo.
 */
function perfilDeAnchuras(datos, w, minX, maxX, minY, maxY) {
  const opaco = (fila, x) => datos[fila + x * 4 + 3] > OPACO
  const centro = Math.round((minX + maxX) / 2)
  const busqueda = Math.max(1, Math.round(w * 0.06))
  const altura = maxY - minY + 1
  const perfil = []

  for (let i = 0; i < FILAS_PERFIL; i++) {
    const y = minY + Math.min(altura - 1, Math.floor(((i + 0.5) / FILAS_PERFIL) * altura))
    const fila = y * w * 4

    // El centro puede caer en un escote o entre las perneras: busca cerca.
    let semilla = -1
    for (let d = 0; d <= busqueda && semilla < 0; d++) {
      if (centro - d >= 0 && opaco(fila, centro - d)) semilla = centro - d
      else if (centro + d < w && opaco(fila, centro + d)) semilla = centro + d
    }
    if (semilla < 0) {
      perfil.push(0)
      continue
    }

    // Se toleran huecos de 1-2 píxeles (costuras, ruido del recorte).
    let a = semilla
    let b = semilla
    while (a > 0 && (opaco(fila, a - 1) || (a > 1 && opaco(fila, a - 2)))) a--
    while (b < w - 1 && (opaco(fila, b + 1) || (b < w - 2 && opaco(fila, b + 2)))) b++
    perfil.push(Number(((b - a + 1) / w).toFixed(4)))
  }

  return perfil
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
        const MAX = 320
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
        let transparentes = 0

        for (let y = 0; y < h; y++) {
          const fila = y * w * 4
          for (let x = 0; x < w; x++) {
            if (datos[fila + x * 4 + 3] <= OPACO) {
              transparentes++
            } else {
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
          perfil: perfilDeAnchuras(datos, w, minX, maxX, minY, maxY),
        }

        // Una foto sin transparencia (fondo sin quitar) no se puede medir.
        acabar(transparentes < w * h * 0.01 ? null : caja)
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
