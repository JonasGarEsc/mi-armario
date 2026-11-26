import { useEffect, useState } from 'react'
import { urlImagen } from '../lib/imagenes'

// Pide una URL firmada y reducida. Si algo falla, cae al original.
export default function Miniatura({ url, alt = '', className = '', ancho = 480 }) {
  const [src, setSrc] = useState(null)
  const [reintento, setReintento] = useState(0)

  useEffect(() => {
    let vivo = true
    setSrc(null)
    urlImagen(url, ancho, reintento > 0).then((resuelta) => {
      if (vivo) setSrc(resuelta)
    })
    return () => {
      vivo = false
    }
  }, [url, ancho, reintento])

  if (!src) return <span className={className} aria-hidden="true" />

  return (
    <img
      src={src}
      onError={() => { if (reintento === 0) setReintento(1) }}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={className}
      alt={alt}
    />
  )
}
