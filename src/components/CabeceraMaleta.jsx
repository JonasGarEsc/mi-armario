import { useEffect, useState } from 'react'
import { vibrar } from '../lib/vibrar'
import Icono from './Icono'
import Miniatura from './Miniatura'
import WidgetClima from './WidgetClima'

/** Cabecera de una maleta abierta: nombre, acciones, clima y lista de la maleta. */
export default function CabeceraMaleta({
  maleta, nombreEditable, onVolver, resumenAbierto, hayConjuntos, onCompartirResumen,
  onClonar, onEliminar, lista, prendas, onPreparar, mostrarToast,
}) {
  const [checklistAbierta, setChecklistAbierta] = useState(false)
  const [nuevaCosa, setNuevaCosa] = useState('')

  useEffect(() => {
    setChecklistAbierta(false)
    setNuevaCosa('')
  }, [maleta?.id])

  const hechas = lista.marcadas.filter(id => prendas.some(p => p.id === id)).length
    + lista.extras.filter(e => e.hecho).length
  const totalLista = prendas.length + lista.extras.length

  function alternarChecklist(id) {
    vibrar(8)
    lista.alternarPrenda(id)
  }

  async function anadirCosa(e) {
    e.preventDefault()
    const n = await lista.anadir(nuevaCosa)
    if (n === -1) return mostrarToast('No se pudo añadir a la lista', 'error')
    if (n === 0 && nuevaCosa.trim()) mostrarToast('Eso ya está en la lista', 'info')
    setNuevaCosa('')
    vibrar(8)
  }

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1 min-h-12">
        <button onClick={onVolver} aria-label="Volver a las maletas" className="boton-icono -ml-3">
          <Icono nombre="volver" />
        </button>
        <h2 className="flex-1 min-w-0 flex">
          {nombreEditable('maleta', maleta.id, maleta.nombre, 'titular min-h-11 max-w-full text-2xl md:text-3xl font-bold tracking-tight')}
        </h2>
        <button onClick={onCompartirResumen} disabled={resumenAbierto || !hayConjuntos} aria-label={`Compartir imagen resumen de ${maleta.nombre}`} className="boton-icono disabled:opacity-40">
          <Icono nombre="compartir" />
        </button>
        <button onClick={onClonar} aria-label={`Duplicar ${maleta.nombre}`} className="boton-icono">
          <Icono nombre="duplicar" />
        </button>
        <button onClick={onEliminar} aria-label={`Eliminar ${maleta.nombre}`} className="boton-icono -mr-2">
          <Icono nombre="borrar" />
        </button>
      </div>
      <WidgetClima maleta={maleta} />

      {lista.listo && (
        <div className="mt-1">
          {lista.error && <p role="alert" className="aviso-error mt-2">{lista.error}</p>}
          <button
            onClick={() => setChecklistAbierta(!checklistAbierta)}
            aria-expanded={checklistAbierta}
            className="min-h-9 flex items-center gap-2 text-sm font-semibold text-acento"
          >
            <Icono nombre="lista" className="w-4 h-4" />
            Lista de la maleta · {hechas}/{totalLista}
          </button>

          {checklistAbierta && (
            <ul className="mt-2 rounded-xl border border-linea divide-y divide-linea overflow-hidden">
              {prendas.map(prenda => {
                const hecha = lista.marcadas.includes(prenda.id)
                return (
                  <li key={prenda.id}>
                    <label className="flex items-center gap-3 px-3 py-2 min-h-11 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hecha}
                        onChange={() => alternarChecklist(prenda.id)}
                        className="w-5 h-5 shrink-0 accent-acento"
                      />
                      <span className={`flex-1 min-w-0 truncate text-sm ${hecha ? 'line-through text-tenue' : ''}`}>{prenda.nombre}</span>
                      <span className="w-8 h-8 shrink-0 rounded bg-foto p-0.5">
                        <Miniatura url={prenda.imagen_url} alt="" className="w-full h-full object-contain" />
                      </span>
                    </label>
                  </li>
                )
              })}
              {lista.extras.map(extra => (
                <li key={extra.id} className="flex items-center gap-1 pl-3">
                  <label className="flex-1 min-w-0 flex items-center gap-3 py-2 min-h-11 cursor-pointer">
                    <input type="checkbox" checked={extra.hecho} onChange={() => { vibrar(8); lista.alternarExtra(extra.id) }} className="w-5 h-5 shrink-0 accent-acento" />
                    <span className={`flex-1 min-w-0 truncate text-sm ${extra.hecho ? 'line-through text-tenue' : ''}`}>{extra.texto}</span>
                  </label>
                  <button onClick={() => lista.quitar(extra.id)} aria-label={`Quitar ${extra.texto} de la lista`} className="boton-icono w-11! h-11! text-tenue">
                    <Icono nombre="cerrar" className="w-4 h-4" />
                  </button>
                </li>
              ))}
              <li>
                <form onSubmit={anadirCosa} className="flex items-center gap-2 p-2">
                  <input value={nuevaCosa} onChange={(e) => setNuevaCosa(e.target.value)} aria-label="Añadir a la lista" placeholder="Añadir: cargador, neceser…" autoComplete="off" className="campo flex-1 min-w-0 min-h-11!" />
                  <button type="submit" disabled={!nuevaCosa.trim()} className="boton boton-secundario min-h-11! px-4!">Añadir</button>
                </form>
              </li>
            </ul>
          )}
        </div>
      )}

      {maleta.fecha_inicio && (
        <button onClick={() => onPreparar?.(maleta)} className="boton boton-secundario w-full mt-3">
          <Icono nombre="maleta" className="w-5 h-5" />
          Prepárala por mí
        </button>
      )}
    </div>
  )
}
