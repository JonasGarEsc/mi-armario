// Exportar un outfit a PNG y compartirlo sin perder el gesto de iOS.

/** Imagen PNG de cualquier elemento de la página. */
export async function generarPngDeElemento(el, nombre, { pixelRatio = 2, prefijo = 'Outfit', estilo } = {}) {
  // Carga bajo demanda: html-to-image solo pesa cuando exportas.
  const { toPng } = await import('html-to-image')
  // `estilo` se aplica a la copia que se captura (útil si el original está fuera de pantalla).
  const dataUrl = await toPng(el, { cacheBust: false, pixelRatio, skipFonts: true, ...(estilo && { style: estilo }) })
  const blob = await (await fetch(dataUrl)).blob()
  const limpio = String(nombre || 'imagen').replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 60)
  const file = new File([blob], `${prefijo}_${limpio}.png`, { type: 'image/png' })
  return { dataUrl, file }
}

export async function generarPng(idLienzo, nombre) {
  const el = document.getElementById(`lienzo-${idLienzo}`)
  if (!el) throw new Error('No encuentro el lienzo del outfit.')
  return generarPngDeElemento(el, nombre)
}

export function descargar(dataUrl, nombre) {
  const enlace = document.createElement('a')
  enlace.href = dataUrl
  const limpio = String(nombre || 'outfit').replace(/[^\p{L}\p{N}]+/gu, '_')
  enlace.download = `Outfit_${limpio}.png`
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
}

/**
 * Debe llamarse desde un clic (no después de un await) para que iOS lo permita.
 * Devuelve true si se compartió y false si el usuario canceló.
 */
export async function compartirArchivo(file, nombre) {
  if (!navigator.canShare || !navigator.canShare({ files: [file] })) return false
  try {
    await navigator.share({ files: [file], title: `Outfit: ${nombre}` })
    return true
  } catch (error) {
    if (error?.name === 'AbortError') return false
    throw error
  }
}

/**
 * Comparte la imagen con el menú del sistema (Web Share) y, si el dispositivo no lo
 * admite, la descarga. `generar` devuelve { dataUrl, file }.
 *
 * Resultado: 'compartido' | 'cancelado' | 'descargado' | 'reintentar'.
 * iOS solo deja compartir justo después de un toque; si la imagen tarda en generarse
 * puede negarse (NotAllowedError). Entonces devuelve 'reintentar' con la imagen ya
 * lista, para ofrecer un segundo botón que sí cuenta como toque.
 */
export async function compartirImagen(generar, nombre, titulo = nombre) {
  const imagen = await generar()
  const { file, dataUrl } = imagen
  if (!globalThis.navigator?.canShare?.({ files: [file] })) {
    descargar(dataUrl, nombre)
    return { estado: 'descargado', ...imagen }
  }
  try {
    await globalThis.navigator.share({ files: [file], title: titulo })
    return { estado: 'compartido', ...imagen }
  } catch (error) {
    if (error?.name === 'AbortError') return { estado: 'cancelado', ...imagen }
    if (error?.name === 'NotAllowedError') return { estado: 'reintentar', ...imagen }
    throw error
  }
}

/** Espera a que carguen las imágenes de un elemento (con tope) y un pelín más a que se coloquen. */
export async function esperarImagenes(el, maxMs = 7000) {
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms))
  const inicio = Date.now()
  while (Date.now() - inicio < maxMs) {
    const imgs = [...el.querySelectorAll('img')]
    if (imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0)) break
    await dormir(150)
  }
  await dormir(450) // PrendaAjustada mide y coloca cada prenda tras cargar su foto
}
