import { composicionMaleta, extraerImagenesMaleta } from '../lib/maletas'
import Miniatura from './Miniatura'

/** Maleta cerrada de la lista: tapa, ruedas y la ropa doblada que asoma al abrirla. */
export default function TarjetaMaleta({ maleta, abierta, onAbrir }) {
  const { imagenes, total } = extraerImagenesMaleta(maleta)
  const { columnas, filas, llena, ancho, alto } = composicionMaleta(imagenes)
  const outfits = maleta.outfits ?? (maleta.conjuntos?.length || 0)

  return (
    <button onClick={onAbrir} aria-label={`Abrir ${maleta.nombre}`} className="min-w-0 self-start text-center rounded-xl">
      <span className={`maleta relative w-[86%] max-w-52 mx-auto pt-8 pb-3 ${abierta ? 'abierta' : ''}`}>
        <span className="maleta-suelo absolute -inset-x-3 -bottom-0.5 h-5" aria-hidden="true" />
        {/* Asa telescópica, patas y ruedas: van en la carcasa trasera, no se mueven con la tapa. */}
        <span className="absolute left-1/2 -translate-x-1/2 top-1 w-[46%] h-8" aria-hidden="true">
          <span className="maleta-barra absolute left-2 top-2 bottom-0 w-1.5" />
          <span className="maleta-barra absolute right-2 top-2 bottom-0 w-1.5" />
          <span className="maleta-goma absolute left-1 bottom-0 w-3.5 h-1.5 rounded-t-sm" />
          <span className="maleta-goma absolute right-1 bottom-0 w-3.5 h-1.5 rounded-t-sm" />
          <span className="maleta-goma absolute inset-x-0 top-0 h-3.5 rounded-full" />
          <span className="maleta-metal absolute left-1/2 -translate-x-1/2 top-1 w-5 h-1.5 rounded-full" />
        </span>
        {['left-[11%]', 'right-[11%]'].map(lado => (
          <span key={lado} className={`absolute ${lado} bottom-0 w-6 h-4`} aria-hidden="true">
            <span className="maleta-goma absolute inset-x-1 top-0 h-2 rounded-b-sm" />
            <span className="maleta-rueda absolute left-0.5 bottom-0 w-2.5 h-2.5 rounded-full" />
            <span className="maleta-rueda absolute right-0.5 bottom-0 w-2.5 h-2.5 rounded-full" />
          </span>
        ))}

        <span className="maleta-cuerpo relative block aspect-[2/3]">
          {/* Asa lateral con su etiqueta de cuero. */}
          <span className="maleta-goma absolute -right-1 top-[24%] w-2 h-[16%] rounded-r-[4px]" aria-hidden="true" />
          <span className="maleta-etiqueta absolute -right-2 top-[38%] w-3 h-[11%] rounded-[2px]" aria-hidden="true" />

          {/* Carcasa trasera y forro: la ropa doblada se ve al abrir la tapa. */}
          <span className="maleta-carcasa absolute inset-0 rounded-[14px] p-[5%]">
            <span className="maleta-interior relative block w-full h-full rounded-[9px] overflow-hidden">
              {imagenes.length === 0 && (
                <>
                  <span className="maleta-correa absolute -inset-x-4 top-1/2 h-3 -translate-y-1/2 rotate-[52deg]" />
                  <span className="maleta-correa absolute -inset-x-4 top-1/2 h-3 -translate-y-1/2 -rotate-[52deg]" />
                  <span className="maleta-metal absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-5 rounded" />
                </>
              )}
              <span className="absolute inset-1.5">
                {imagenes.map((url, i) => {
                  const fila = Math.floor(i / columnas)
                  // Si la última fila queda coja, la prenda suelta va centrada.
                  const suelta = columnas === 2 && i === imagenes.length - 1 && i % 2 === 0
                  return (
                    <span key={url} className="maleta-prenda absolute" style={{
                      left: `${suelta ? (100 - ancho) / 2 : (i % columnas) * (100 - ancho)}%`,
                      top: `${filas > 1 ? fila * (100 - alto) / (filas - 1) : 0}%`,
                      width: `${ancho}%`,
                      height: `${alto}%`,
                      '--giro': `${llena ? (i % 2 ? 1 : -1) : [-2, 1.5, 2.5, -1.5][i]}deg`,
                      '--retardo': `${120 + fila * 50}ms`,
                    }}>
                      <Miniatura url={url} alt="" className="w-full h-full object-contain" />
                    </span>
                  )
                })}
              </span>
            </span>
          </span>

          {/* Tapa con bisagra a la izquierda: cara exterior y forro por detrás. */}
          <span className="maleta-tapa absolute inset-0" aria-hidden="true">
            <span className="maleta-reverso absolute inset-0 rounded-[14px]">
              <span className="maleta-bolsillo absolute inset-x-3 bottom-3 h-[46%] rounded-lg" />
            </span>
            <span className="maleta-cara maleta-carcasa absolute inset-0 rounded-[14px] overflow-hidden">
              {/* Acanalado del aluminio y junta del perímetro. */}
              <span className="maleta-costillas absolute inset-x-[8%] inset-y-[5%]" />
              <span className="maleta-junta absolute inset-[3.5%] rounded-[11px]" />
              {/* Cierre con candado, encastrado en el borde que se abre. */}
              <span className="maleta-cierre absolute right-[5%] top-[44%] w-[11%] h-[12%] rounded-[3px]">
                <span className="maleta-metal absolute inset-x-[22%] top-[18%] h-[26%] rounded-[2px]" />
                <span className="maleta-ruedecillas absolute inset-x-[22%] bottom-[16%] h-[30%] rounded-[1px]" />
              </span>
            </span>
          </span>

          {/* Bisagras sobre el eje de giro. */}
          <span className="maleta-bisagra absolute -left-[3px] top-[15%] w-[5px] h-[9%] rounded-[2px]" aria-hidden="true" />
          <span className="maleta-bisagra absolute -left-[3px] bottom-[15%] w-[5px] h-[9%] rounded-[2px]" aria-hidden="true" />
        </span>
      </span>
      <span className="block mt-2 font-semibold leading-6 truncate">{maleta.nombre}</span>
      <span className="block text-sm leading-6 text-tenue truncate">{outfits === 1 ? '1 outfit' : `${outfits} outfits`}{total > 0 && `, ${total === 1 ? '1 prenda' : `${total} prendas`}`}</span>
    </button>
  )
}
