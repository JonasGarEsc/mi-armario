// Retoque a mano de una foto: coordenadas del pincel, trazos, historial y
// encuadre de la parte visible. Sin DOM, para poder probarlo con node:test.

export const MAX_HISTORIAL = 8
export const MAX_LIENZO = 1200

/** Pasa un punto de la pantalla a coordenadas internas del lienzo. */
export function puntoDePincel(clienteX, clienteY, rect, ancho, alto) {
  const anchoVisible = rect?.width || 0
  const altoVisible = rect?.height || 0
  if (!anchoVisible || !altoVisible) return { x: 0, y: 0 }
  return {
    x: ((clienteX - rect.left) / anchoVisible) * ancho,
    y: ((clienteY - rect.top) / altoVisible) * alto,
  }
}

/** Radio interno para que el pincel mida siempre lo mismo en pantalla. */
export function radioDePincel(tamano, anchoLienzo, anchoMostrado) {
  const escala = anchoLienzo / Math.max(1, anchoMostrado)
  return Math.max(1, (tamano / 2) * escala)
}

/** Puntos intermedios de un trazo: sin huecos aunque el dedo vaya rápido. */
export function puntosDelTrazo(x0, y0, x1, y1, separacion = 2) {
  const dx = x1 - x0
  const dy = y1 - y0
  const distancia = Math.hypot(dx, dy)
  const paso = Math.max(0.5, Number(separacion) || 1)
  const pasos = Math.ceil(distancia / paso)
  const puntos = []

  for (let i = 1; i <= Math.max(1, pasos); i++) {
    puntos.push([x0 + (dx * i) / Math.max(1, pasos), y0 + (dy * i) / Math.max(1, pasos)])
  }

  return puntos
}

/** Añade una instantánea sin crecer sin límite ni mutar el historial. */
export function agregarAlHistorial(historial, instantanea, maximo = MAX_HISTORIAL) {
  if (!instantanea) return historial
  const nuevo = [...historial, instantanea]
  return nuevo.length > maximo ? nuevo.slice(nuevo.length - maximo) : nuevo
}

/** Tamaño del lienzo: mantiene la proporción y no agranda fotos pequeñas. */
export function medidasDeLienzo(ancho, alto, maximo = MAX_LIENZO) {
  const mayor = Math.max(ancho || 0, alto || 0)
  if (mayor <= 0) return { ancho: 1, alto: 1 }
  const escala = Math.min(1, maximo / mayor)
  return {
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
  }
}

/**
 * Encaje de la caja visible dentro del hueco, partiendo del tamaño que ya
 * ocupa la foto con object-contain. Devuelve null si la foto no se puede medir.
 */
export function encuadreVisible(caja, ancho, alto) {
  if (!caja || !caja.relacion || !(ancho > 0) || !(alto > 0)) return null
  if (!(caja.w > 0) || !(caja.h > 0)) return null

  // Dónde pinta object-contain la foto completa dentro del hueco.
  const anchoDibujo = ancho / alto > caja.relacion ? alto * caja.relacion : ancho
  const altoDibujo = anchoDibujo / caja.relacion
  const origenX = (ancho - anchoDibujo) / 2
  const origenY = (alto - altoDibujo) / 2

  // Caja visible y escala que la lleva a ocupar el hueco entero.
  const visibleX = origenX + caja.x * anchoDibujo
  const visibleY = origenY + caja.y * altoDibujo
  const visibleW = caja.w * anchoDibujo
  const visibleH = caja.h * altoDibujo
  const escala = Math.min(ancho / visibleW, alto / visibleH)
  if (!Number.isFinite(escala) || escala <= 0) return null

  const x = (ancho - visibleW * escala) / 2 - visibleX * escala
  const y = (alto - visibleH * escala) / 2 - visibleY * escala

  return {
    x,
    y,
    escala,
    transformOrigin: '0 0',
    transform: `translate(${x.toFixed(3)}px, ${y.toFixed(3)}px) scale(${escala.toFixed(5)})`,
  }
}

/** Descarga la foto guardada (URL firmada) como archivo para poder editarla. */
export async function fotoDesdeUrl(url, ancho, obtenerUrl) {
  if (typeof obtenerUrl !== 'function') throw new Error('No se pudo cargar la foto.')
  const firmada = await obtenerUrl(url, ancho)
  if (!firmada) throw new Error('No se pudo cargar la foto.')

  const respuesta = await fetch(firmada)
  if (!respuesta.ok) throw new Error('No se pudo descargar la foto.')

  const blob = await respuesta.blob()
  return new File([blob], `foto-${Date.now()}`, { type: blob.type || 'image/webp' })
}
