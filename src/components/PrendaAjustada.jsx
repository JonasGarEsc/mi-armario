import { useEffect, useState } from 'react'
import { rutaImagen } from '../lib/imagenes'
import { cajaVisible, encajarCaja } from '../lib/recorte'
import { useImagenFirmada } from '../lib/useImagenFirmada'

/**
 * Foto de una prenda. Si `ajustar` está activo, recorta los márgenes
 * transparentes y escala la parte visible para cubrir el hueco del maniquí.
 */
export default function PrendaAjustada({
  url,
  ancho = 720,
  aspecto = 1,
  objetivo = null,
  ajustar = true,
  alt = '',
}) {
  const { src, fallar } = useImagenFirmada(url, ancho)
  const [caja, setCaja] = useState(undefined)

  useEffect(() => {
    let vivo = true
    setCaja(undefined)
    if (!src || !ajustar) return () => { vivo = false }

    cajaVisible(src, rutaImagen(url)).then((resultado) => {
      if (vivo) setCaja(resultado)
    })

    return () => {
      vivo = false
    }
  }, [src, url, ajustar])

  if (!src) return <span className="block h-full w-full" aria-hidden="true" />

  const encaje = ajustar && caja ? encajarCaja(caja, aspecto, objetivo) : null
  const estilo = encaje
    ? {
        width: `${encaje.ancho}%`,
        height: `${encaje.alto}%`,
        left: `${encaje.izquierda}%`,
        top: `${encaje.arriba}%`,
      }
    : undefined

  return (
    <span className="relative block h-full w-full overflow-hidden">
      <img
        src={src}
        onError={fallar}
        alt={alt}
        draggable={false}
        loading="lazy"
        decoding="async"
        style={estilo}
        className={
          encaje
            ? 'pointer-events-none absolute max-w-none select-none drop-shadow-sm'
            : `pointer-events-none h-full w-full select-none drop-shadow-sm ${
                ajustar ? 'object-cover' : 'object-contain'
              }`
        }
      />
    </span>
  )
}
