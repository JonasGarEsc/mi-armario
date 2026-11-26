import { useEffect, useState } from 'react'
import { rutaImagen } from '../lib/imagenes'
import { RANURAS, VESTIR } from '../lib/maniqui'
import { cajaVisible } from '../lib/recorte'
import { useImagenFirmada } from '../lib/useImagenFirmada'
import { vestirPrenda } from '../lib/vestir'

/**
 * Foto de una prenda. Con `ranura`, la viste sobre el maniquí (ver
 * lib/vestir); su largo sale de `largo` (etiqueta) o, si no hay, de `textos`
 * = [nombre, categoría, tipo].
 * La foto puede salirse del hueco, que solo sirve de asa.
 * `escala` (0,8-1,2) agranda o encoge la prenda desde su borde superior, como al
 * pellizcarla; `porDentro` mete la camiseta en el pantalón: se corta un poco por
 * debajo de la cinturilla (el pantalón, que va por encima, tapa el resto).
 */
export default function PrendaAjustada({
  url, ancho = 720, ranura = null, textos = [], largo = null, escala = 1, porDentro = false, alt = '',
}) {
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
  const puesta = hueco && caja ? vestirPrenda(caja, ranura, textos, largo) : null
  // Del escenario (0-100) a porcentajes del hueco que contiene la foto.
  const estilo = puesta
    ? {
        left: `${((puesta.x - hueco.x) / hueco.w) * 100}%`,
        top: `${((puesta.y - hueco.y) / hueco.h) * 100}%`,
        width: `${(puesta.w / hueco.w) * 100}%`,
        height: `${(puesta.h / hueco.h) * 100}%`,
        ...(escala !== 1 && {
          transform: `scale(${escala})`,
          // Crece desde el centro del cuerpo y el borde de arriba de la prenda: los hombros no se mueven.
          transformOrigin: `${((50 - puesta.x) / puesta.w) * 100}% ${caja.y * 100}%`,
        }),
        ...(porDentro && {
          clipPath: `inset(0 0 ${Math.max(0, Math.min(100, 100 - ((VESTIR.piernas.arriba + 1.5 - puesta.y) / puesta.h) * 100))}% 0)`,
        }),
      }
    : undefined

  return (
    <span className={`relative block h-full w-full ${puesta ? '' : 'overflow-hidden'}`}>
      <img
        crossOrigin="anonymous"
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
