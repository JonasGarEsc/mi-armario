import EstadoVacio from './EstadoVacio'
import Icono from './Icono'
import LienzoOutfit from './LienzoOutfit'

/** Outfits de una maleta abierta, con su estado de carga, búsqueda vacía y acciones. */
export default function ListaOutfits({ items, busqueda, cargando, nombreEditable, onCompartir, onClonar, onEliminar, onGuardarEstado }) {
  if (cargando) {
    return (
      <div role="status" aria-label="Cargando" className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="esqueleto h-114 md:h-139" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <EstadoVacio
        dibujo="maleta"
        titulo={busqueda ? 'Nada coincide con la búsqueda' : 'Esta maleta está vacía'}
        texto={busqueda
          ? 'Prueba con otro nombre.'
          : 'Elige prendas en el armario y crea un outfit para esta maleta.'}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
      {items.map((conj) => (
        <article key={conj.id} className="min-w-0 rounded-xl border border-linea bg-superficie overflow-hidden isolate">
          <div className="flex items-center pl-4 pr-1 h-14 border-b border-linea">
            <h3 className="flex-1 min-w-0 flex">
              {nombreEditable('outfit', conj.id, conj.nombre, 'min-h-11 max-w-full text-lg font-semibold')}
            </h3>
            <button onClick={() => onCompartir(conj)} aria-label={`Compartir imagen de ${conj.nombre}`} className="boton-icono">
              <Icono nombre="compartir" className="w-5 h-5" />
            </button>
            <button onClick={(e) => onClonar(conj, e)} aria-label={`Duplicar ${conj.nombre}`} className="boton-icono">
              <Icono nombre="duplicar" className="w-5 h-5" />
            </button>
            <button onClick={(e) => onEliminar(conj.id, e)} aria-label={`Eliminar ${conj.nombre}`} className="boton-icono">
              <Icono nombre="borrar" className="w-5 h-5" />
            </button>
          </div>

          <LienzoOutfit conjunto={conj} onGuardarEstado={onGuardarEstado} ampliado />
        </article>
      ))}
    </div>
  )
}
