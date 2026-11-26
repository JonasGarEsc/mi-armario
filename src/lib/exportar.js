// Exportar un outfit a PNG y compartirlo sin perder el gesto de iOS.

export async function generarPng(idLienzo, nombre) {
  const el = document.getElementById(`lienzo-${idLienzo}`)
  if (!el) throw new Error('No encuentro el lienzo del outfit.')

  // Carga bajo demanda: html-to-image solo pesa cuando exportas.
  const { toPng } = await import('html-to-image')
  const dataUrl = await toPng(el, {
    cacheBust: false,
    pixelRatio: 2,
    skipFonts: true,
  })

  const blob = await (await fetch(dataUrl)).blob()
  const limpio = String(nombre || 'outfit').replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 60)
  const file = new File([blob], `Outfit_${limpio}.png`, { type: 'image/png' })
  return { dataUrl, file }
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
