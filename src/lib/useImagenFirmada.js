import { useCallback, useEffect, useState } from 'react'
import { urlImagen } from './imagenes'

/** Pide una URL firmada y reducida. Si algo falla, deja reintentar una vez. */
export function useImagenFirmada(url, ancho = 480) {
  const [src, setSrc] = useState(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vivo = true
    setSrc(null)
    urlImagen(url, ancho, intento > 0).then((resuelta) => {
      if (vivo) setSrc(resuelta)
    })
    return () => {
      vivo = false
    }
  }, [url, ancho, intento])

  const fallar = useCallback(() => {
    setIntento((valor) => (valor === 0 ? 1 : valor))
  }, [])

  return { src, fallar }
}
