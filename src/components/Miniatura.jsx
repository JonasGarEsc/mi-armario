import { useLayoutEffect, useRef, useState } from 'react'
import { rutaImagen } from '../lib/imagenes'
import { cajaVisible } from '../lib/recorte'
import { encuadreVisible } from '../lib/retoque'
import { useImagenFirmada } from '../lib/useImagenFirmada'

/**
 * Foto pequeña de una prenda. Si la foto tiene transparencia, se encuadra por
 * su contorno visible (igual que el maniquí) para que todas pesen lo mismo;
 * las fotos sin transparencia se quedan como estaban.
 */
export default function Miniatura({ url, alt = '', className = '', ancho = 480 }) {
  const { src, fallar } = useImagenFirmada(url, ancho)
  const imagen = useRef(null)
  const [medida, setMedida] = useState(null)
  const [hueco, setHueco] = useState(null)
  const caja = medida?.src === src ? medida.caja : null

  // Se mide al cargar, no antes: así las fotos fuera de pantalla siguen sin descargarse.
  const alCargar = () => cajaVisible(src, rutaImagen(url)).then((resultado) => setMedida({ src, caja: resultado }))

  useLayoutEffect(() => {
    const img = imagen.current
    if (!img || !caja) return undefined
    const medir = () => setHueco({ ancho: img.clientWidth, alto: img.clientHeight })
    medir()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observador = new ResizeObserver(medir)
    observador.observe(img)
    return () => observador.disconnect()
  }, [src, caja])

  if (!src) return <span className={className} aria-hidden="true" />

  const encuadre = caja && hueco ? encuadreVisible(caja, hueco.ancho, hueco.alto) : null

  return (
    <span className={`relative block overflow-hidden ${className}`}>
      <img
        crossOrigin="anonymous"
        ref={imagen}
        src={src}
        onError={fallar}
        onLoad={alCargar}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="h-full w-full object-contain"
        style={encuadre ? { transform: encuadre.transform, transformOrigin: encuadre.transformOrigin } : undefined}
        alt={alt}
      />
    </span>
  )
}
