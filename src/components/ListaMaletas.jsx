import EstadoVacio from './EstadoVacio'
import Icono from './Icono'
import TarjetaMaleta from './TarjetaMaleta'

/** Rejilla de maletas con su estado vacío y el botón para crear otra. */
export default function ListaMaletas({ items, busqueda, cargando, abriendoId, hayMaletas, onEntrar, onCrearMaleta }) {
  return (
    <>
      {cargando ? (
        <div role="status" aria-label="Cargando" className="rejilla">
          {[0, 1].map(i => <div key={i}><div className="esqueleto aspect-[2/3] w-[86%] max-w-52 mx-auto mt-8 mb-3" /><div className="h-12 mt-2 flex flex-col items-center justify-center gap-2"><div className="esqueleto h-3 w-2/3" /><div className="esqueleto h-3 w-1/3" /></div></div>)}
        </div>
      ) : items.length === 0 ? (
        <EstadoVacio
          dibujo="maleta"
          titulo={busqueda ? 'Nada coincide con la búsqueda' : 'Todavía no hay maletas'}
          texto={busqueda
            ? 'Prueba con otro nombre.'
            : 'Crea una, elige prendas del armario y monta los outfits dentro.'}
          accionTexto={!busqueda ? 'Nueva maleta' : undefined}
          onAccion={!busqueda ? onCrearMaleta : undefined}
        />
      ) : (
        <div className="rejilla mb-4">
          {items.map((m) => (
            <TarjetaMaleta key={m.id} maleta={m} abierta={abriendoId === m.id} onAbrir={() => onEntrar(m)} />
          ))}
        </div>
      )}

      {!cargando && hayMaletas && (
        <button onClick={onCrearMaleta} className="accion boton boton-primario">
          <Icono nombre="mas" className="w-5 h-5" />
          Nueva maleta
        </button>
      )}
    </>
  )
}
