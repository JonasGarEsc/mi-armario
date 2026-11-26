import { useImagenFirmada } from '../lib/useImagenFirmada'

export default function Miniatura({ url, alt = '', className = '', ancho = 480 }) {
  const { src, fallar } = useImagenFirmada(url, ancho)

  if (!src) return <span className={className} aria-hidden="true" />

  return (
    <img
      src={src}
      onError={fallar}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={className}
      alt={alt}
    />
  )
}
