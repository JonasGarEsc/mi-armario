import { useEffect, useState } from 'react'
import { rutaImagen } from '../lib/imagenes'
import { RANURAS } from '../lib/maniqui'
import { cajaVisible } from '../lib/recorte'
import { useImagenFirmada } from '../lib/useImagenFirmada'
import { vestirPrenda } from '../lib/vestir'

/**
 * Foto de una prenda. Con `ranura`, la viste sobre el maniquí (ver
 * lib/vestir); `textos` = [nombre, categoría, tipo] decide su largo.
 * La foto puede salirse del hueco, que solo sirve de asa.
 */
export default function PrendaAjustada({ url, ancho = 720, ranura = null, textos = [], alt = '' }) {
  const { src, fallar } = useImagenFirmada(url, ancho)
  const [caja, setCaja] = useState(undefined)

  useEffect(() => {
    let vivo = true
    setCaja(undefined)
    if (!src || !ranura) return () => { vivo = false }

    cajaVisible(src, rutaImagen(url)).then((resultado) => {
      if (vivo) setCaja(resultado)
    })

    return () => {
      vivo = false
    }
  }, [src, url, ranura])

  if (!src) return <span className="block h-full w-full" aria-hidden="true" />

  const hueco = ranura ? RANURAS[ranura] : null
  const puesta = hueco && caja ? vestirPrenda(caja, ranura, textos) : null
  // Del escenario (0-100) a porcentajes del hueco que contiene la foto.
  const estilo = puesta
    ? {
        left: `${((puesta.x - hueco.x) / hueco.w) * 100}%`,
        top: `${((puesta.y - hueco.y) / hueco.h) * 100}%`,
        width: `${(puesta.w / hueco.w) * 100}%`,
        height: `${(puesta.h / hueco.h) * 100}%`,
      }
    : undefined

  return (
    <span className={`relative block h-full w-full ${puesta ? '' : 'overflow-hidden'}`}>
      <img
        src={src}
        onError={fallar}
        alt={alt}
        draggable={false}
        loading="lazy"
        decoding="async"
        style={estilo}
        className={
          puesta
            ? 'pointer-events-none absolute max-w-none select-none drop-shadow-sm'
            : 'pointer-events-none h-full w-full select-none object-contain drop-shadow-sm'
        }
      />
    </span>
  )
}
