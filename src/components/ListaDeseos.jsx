import { useMemo } from 'react'
import { resumenDeseos } from '../lib/deseos'
import { dinero } from '../lib/estadisticas'
import EstadoVacio from './EstadoVacio'
import Icono from './Icono'
import Miniatura from './Miniatura'

/** Lo que aún no tienes: cuánto combina con tu armario, y «Ya lo tengo» lo pasa a él. */
export default function ListaDeseos({ deseos, armario, onAnadir, onVerOutfits, onYaLoTengo, onEliminar }) {
  const filas = useMemo(() => resumenDeseos(deseos, armario), [deseos, armario])

  if (deseos.length === 0) {
    return (
      <EstadoVacio
        dibujo="lista"
        titulo="Nada en tu lista de deseos"
        texto="Añade la foto de algo que quieres comprar y te digo con cuántas de tus prendas combina."
        accionTexto="Añadir un deseo"
        onAccion={onAnadir}
      />
    )
  }

  return (
    <>
      <div className="rejilla mb-4">
        {filas.map(({ deseo, combina }) => (
          <article key={deseo.id} className="min-w-0 flex flex-col">
            <div className="relative block w-full aspect-4/5 rounded-xl bg-foto overflow-hidden">
              <Miniatura url={deseo.imagen_url} alt={deseo.nombre} className="w-full h-full object-contain p-3 md:p-4" />
            </div>
            <div className="mt-2 flex items-start gap-1">
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-6 truncate">{deseo.nombre}</p>
                {typeof deseo.precio === 'number' && <p className="text-sm leading-6 text-tenue">{dinero(deseo.precio)}</p>}
                <p className={`text-sm leading-5 font-medium ${combina.length > 0 ? 'text-acento' : 'text-tenue'}`}>
                  {combina.length === 0 ? 'No combina con nada de lo que tienes' : `Combina con ${combina.length} ${combina.length === 1 ? 'prenda' : 'prendas'}`}
                </p>
              </div>
              <button onClick={(e) => onEliminar(deseo, e)} aria-label={`Quitar ${deseo.nombre} de la lista`} className="boton-icono -mr-2 text-tenue">
                <Icono nombre="borrar" className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              <button onClick={() => onVerOutfits(deseo)} disabled={combina.length === 0} className="boton boton-secundario min-h-11! text-sm!">Ver outfits</button>
              <button onClick={() => onYaLoTengo(deseo)} className="boton boton-secundario min-h-11! text-sm!">Ya lo tengo</button>
            </div>
          </article>
        ))}
      </div>
      <button onClick={onAnadir} className="accion boton boton-primario">
        <Icono nombre="mas" className="w-5 h-5" />
        Añadir un deseo
      </button>
    </>
  )
}
