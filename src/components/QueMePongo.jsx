import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { ciudadGuardada, climaDeHoy, guardarCiudad } from '../lib/clima'
import { isoLocal } from '../lib/fechas'
import { OCASIONES, sugerirOutfits } from '../lib/sugerir'
import { comoConjunto, guardarOutfitDeHoy } from '../lib/propuestas'
import { claveDeOutfit } from '../lib/valoraciones'
import { useValoraciones } from '../lib/useValoraciones'
import { vibrar } from '../lib/vibrar'
import { usePrendas } from '../lib/almacen'
import BotonesValoracion from './BotonesValoracion'
import LienzoOutfit from './LienzoOutfit'
import Miniatura from './Miniatura'

// Temperaturas de respaldo cuando no se puede saber el tiempo.
const MANUAL = [
  { id: 'frio', etiqueta: 'Frío', clima: { temp: 4, lluvia: false } },
  { id: 'fresco', etiqueta: 'Fresco', clima: { temp: 13, lluvia: false } },
  { id: 'templado', etiqueta: 'Templado', clima: { temp: 20, lluvia: false } },
  { id: 'calor', etiqueta: 'Calor', clima: { temp: 30, lluvia: false } },
]

const chip = (activo) =>
  `shrink-0 min-h-11 px-4 rounded-[10px] border text-sm font-medium whitespace-nowrap ${activo ? 'bg-acento text-sobre-acento border-acento' : 'bg-superficie border-linea text-tinta'}`

export default function QueMePongo({ mostrarToast, onHecho, prendaInicial = null }) {
  const { prendas, cargando: cargandoPrendas } = usePrendas()
  const { valoraciones, cargando: cargandoValoraciones, valorar } = useValoraciones()
  const [tiempo, setTiempo] = useState('cargando') // 'cargando' | null | { clima, origen, ciudad }
  const [manual, setManual] = useState(null)
  const [ciudad, setCiudad] = useState(ciudadGuardada())
  const [ocasion, setOcasion] = useState('cualquiera')
  const [fijadas, setFijadas] = useState(() => (prendaInicial ? [prendaInicial] : []))
  const [propuestas, setPropuestas] = useState([])
  const [guardando, setGuardando] = useState(null)
  const vistos = useRef(new Set())
  // Las propuestas ya en pantalla no cambian al valorarlas: así se puede
  // deshacer el toque. El mapa nuevo se usa para la siguiente propuesta.
  const valoracionesRef = useRef(valoraciones)
  valoracionesRef.current = valoraciones

  const hoy = isoLocal(new Date())

  useEffect(() => {
    let vivo = true
    climaDeHoy().then((t) => { if (vivo) setTiempo(t) })
    return () => { vivo = false }
  }, [])

  const clima = manual?.clima || (tiempo && tiempo !== 'cargando' ? tiempo.clima : null)

  // Se recalculan las tres propuestas al cambiar el tiempo, la ocasión o lo fijado.
  useEffect(() => {
    const mapa = valoracionesRef.current
    if (cargandoPrendas || !clima || !mapa) { setPropuestas([]); return }
    vistos.current = new Set()
    const nuevas = sugerirOutfits(prendas, { clima, hoy, ocasion, fijadas, n: 3, valoraciones: mapa })
    nuevas.forEach((o) => vistos.current.add(o.clave))
    setPropuestas(nuevas)
  }, [prendas, cargandoPrendas, clima, ocasion, fijadas, hoy, cargandoValoraciones])

  const conjuntos = useMemo(() => propuestas.map(comoConjunto), [propuestas])

  function otra(indice) {
    vibrar(10)
    const resto = propuestas.filter((_, i) => i !== indice).map((o) => o.ids)
    const [nueva] = sugerirOutfits(prendas, {
      clima, hoy, ocasion, fijadas, n: 1, descartar: [...vistos.current], mantener: resto, valoraciones,
    })
    if (!nueva) { mostrarToast('No tengo otra combinación distinta con esas prendas', 'info'); return }
    vistos.current.add(nueva.clave)
    setPropuestas((actuales) => actuales.map((o, i) => (i === indice ? nueva : o)))
  }

  const alternarFijada = (id) => {
    vibrar(10)
    setFijadas((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))
  }

  async function usarCiudad() {
    guardarCiudad(ciudad)
    setTiempo('cargando')
    setTiempo(await climaDeHoy({ ciudad, forzar: true }))
  }

  /** «Me lo pongo»: lo deja como outfit de hoy en la Semana y anota el uso de cada prenda. */
  async function mePongo(outfit) {
    setGuardando(outfit.clave)
    try {
      const { yaEsta } = await guardarOutfitDeHoy(supabase, outfit, hoy)
      vibrar([40, 40])
      mostrarToast(yaEsta ? 'Ese outfit ya estaba en tu semana; anotado el uso' : 'Outfit de hoy guardado en tu semana', 'exito')
      onHecho?.()
    } catch (e) {
      mostrarToast(e.message || 'No se pudo guardar', 'error')
      setGuardando(null)
    }
  }

  const cargandoTodo = cargandoPrendas || tiempo === 'cargando' || cargandoValoraciones
  const sinTiempo = !cargandoTodo && !clima

  return (
    <div className="flex flex-col gap-4 text-left">
      <h2 className="titulo-hoja">¿Qué me pongo hoy?</h2>

      {cargandoTodo && <div role="status" aria-label="Preparando propuestas" className="esqueleto aspect-square max-w-xs w-full mx-auto" />}

      {sinTiempo && (
        <div className="flex flex-col gap-3">
          <p className="text-tenue">No he podido saber el tiempo de hoy. Dime tu ciudad o cómo hace.</p>
          <div className="flex gap-2">
            <input aria-label="Tu ciudad" placeholder="Madrid" value={ciudad} onChange={(e) => setCiudad(e.target.value)} className="campo flex-1 min-w-0" />
            <button onClick={usarCiudad} disabled={!ciudad.trim()} className="boton boton-secundario">Usar</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {MANUAL.map((m) => <button key={m.id} onClick={() => setManual(m)} className={chip(false)}>{m.etiqueta}</button>)}
          </div>
        </div>
      )}

      {clima && (
        <>
          <p className="text-tenue -mt-2">
            {manual ? `Para un día ${manual.etiqueta.toLowerCase()}` : `Hoy${tiempo?.ciudad ? ` en ${tiempo.ciudad}` : ''}: ${clima.min}° – ${clima.max}°`}
            {clima.lluvia && ' · lluvia'}
          </p>

          <div role="group" aria-label="Ocasión" className="-mx-1 px-1 flex gap-2 overflow-x-auto sin-barra">
            {Object.entries(OCASIONES).map(([id, o]) => (
              <button key={id} onClick={() => setOcasion(id)} aria-pressed={ocasion === id} className={chip(ocasion === id)}>{o.etiqueta}</button>
            ))}
          </div>
        </>
      )}

      {clima && !cargandoPrendas && propuestas.length === 0 && (
        <div className="py-8 text-center text-tenue">
          <p className="font-semibold text-tinta">No encuentro un conjunto completo</p>
          <p className="mt-1">Hace falta al menos una prenda de arriba y otra de abajo (o un vestido). {fijadas.length > 0 && 'Prueba a quitar lo fijado.'}</p>
        </div>
      )}

      {propuestas.length > 0 && (
        <div className="-mx-5 px-5 flex gap-3 overflow-x-auto snap-x snap-mandatory sin-barra pb-1">
          {propuestas.map((outfit, i) => (
            <article key={outfit.clave} aria-label={`Propuesta ${i + 1}`} className="snap-center shrink-0 w-[85%] max-w-sm rounded-xl border border-linea bg-superficie overflow-hidden">
              <LienzoOutfit conjunto={conjuntos[i]} soloLectura />

              <div className="p-3 flex flex-col gap-3">
                <div className="flex gap-2 overflow-x-auto sin-barra" role="group" aria-label="Fijar prendas">
                  {Object.values(outfit.piezas).filter(Boolean).map((p) => {
                    const fijada = fijadas.includes(p.id)
                    return (
                      <button key={p.id} onClick={() => alternarFijada(p.id)} aria-pressed={fijada} aria-label={`${fijada ? 'Soltar' : 'Fijar'} ${p.nombre}`} className={`relative shrink-0 w-12 h-12 rounded-lg bg-foto p-1 border-2 ${fijada ? 'border-acento' : 'border-transparent'}`}>
                        <Miniatura url={p.imagen_url} alt="" className="w-full h-full object-contain" />
                        {fijada && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-acento text-sobre-acento text-xs flex items-center justify-center" aria-hidden="true">•</span>}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-tenue -mt-1">Toca una prenda para llevarla sí o sí.</p>

                <BotonesValoracion
                  valor={valoraciones?.get(claveDeOutfit(outfit.ids)) ?? 0}
                  onValorar={(v) => valorar(claveDeOutfit(outfit.ids), v, mostrarToast)}
                  etiqueta={`la propuesta ${i + 1}`}
                />

                <div className="flex gap-2">
                  <button onClick={() => otra(i)} disabled={guardando !== null} className="boton boton-secundario flex-1">Otra</button>
                  <button onClick={() => mePongo(outfit)} disabled={guardando !== null} className="boton boton-primario flex-1">
                    {guardando === outfit.clave ? 'Guardando…' : 'Me lo pongo'}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
