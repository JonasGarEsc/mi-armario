import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { ciudadGuardada, climaDeHoy, guardarCiudad } from '../lib/clima'
import { isoLocal } from '../lib/fechas'
import { esDuplicado } from '../lib/outfits'
import { nombreLibre } from '../lib/nombres'
import { RANURAS } from '../lib/maniqui'
import { semanaNuevaPara, semanaParaFecha } from '../lib/semanas'
import { OCASIONES, huecoDe, sugerirOutfits } from '../lib/sugerir'
import { vibrar } from '../lib/vibrar'
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
  `shrink-0 min-h-11 px-4 rounded-full border text-sm font-medium whitespace-nowrap ${activo ? 'bg-acento text-sobre-acento border-acento' : 'bg-superficie border-linea text-tinta'}`

/** Outfit propuesto → el formato que entiende el lienzo del maniquí. */
function comoConjunto(outfit) {
  const piezas = Object.values(outfit.piezas).filter(Boolean)
  return {
    id: `sug-${outfit.clave}`,
    conjunto_prenda: piezas.map((p) => {
      const ranura = huecoDe(p)
      return { conjunto_id: 'sug', prenda_id: p.id, ranura, z_index: RANURAS[ranura].capa, pos_x: 0, pos_y: 0, prendas: p }
    }),
  }
}

export default function QueMePongo({ mostrarToast, onHecho, prendaInicial = null }) {
  const [prendas, setPrendas] = useState(null)
  const [tiempo, setTiempo] = useState('cargando') // 'cargando' | null | { clima, origen, ciudad }
  const [manual, setManual] = useState(null)
  const [ciudad, setCiudad] = useState(ciudadGuardada())
  const [ocasion, setOcasion] = useState('cualquiera')
  const [fijadas, setFijadas] = useState(() => (prendaInicial ? [prendaInicial] : []))
  const [propuestas, setPropuestas] = useState([])
  const [guardando, setGuardando] = useState(null)
  const vistos = useRef(new Set())

  const hoy = isoLocal(new Date())

  useEffect(() => {
    let vivo = true
    supabase
      .from('prendas')
      .select('*, categorias(nombre, tipos(nombre)), usos(fecha)')
      .then(({ data }) => { if (vivo) setPrendas(data || []) })
    climaDeHoy().then((t) => { if (vivo) setTiempo(t) })
    return () => { vivo = false }
  }, [])

  const clima = manual?.clima || (tiempo && tiempo !== 'cargando' ? tiempo.clima : null)

  // Se recalculan las tres propuestas al cambiar el tiempo, la ocasión o lo fijado.
  useEffect(() => {
    if (!prendas || !clima) { setPropuestas([]); return }
    vistos.current = new Set()
    const nuevas = sugerirOutfits(prendas, { clima, hoy, ocasion, fijadas, n: 3 })
    nuevas.forEach((o) => vistos.current.add(o.clave))
    setPropuestas(nuevas)
  }, [prendas, clima, ocasion, fijadas, hoy])

  const conjuntos = useMemo(() => propuestas.map(comoConjunto), [propuestas])

  function otra(indice) {
    vibrar(10)
    const resto = propuestas.filter((_, i) => i !== indice).map((o) => o.ids)
    const [nueva] = sugerirOutfits(prendas, {
      clima, hoy, ocasion, fijadas, n: 1, descartar: [...vistos.current], mantener: resto,
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
      const { data: semanas } = await supabase.from('semanas').select('id, fecha_inicio, fecha_fin')
      let semana = semanaParaFecha(semanas, hoy)
      if (!semana) {
        const { data, error } = await supabase.from('semanas').insert([semanaNuevaPara(hoy)]).select('id, fecha_inicio, fecha_fin').single()
        if (error) throw new Error('No se pudo crear la semana')
        semana = data
      }

      const { data: delDia } = await supabase
        .from('conjuntos').select('id, nombre, conjunto_prenda(prenda_id)').eq('semana_id', semana.id).eq('fecha', hoy)
      const yaEsta = esDuplicado(delDia, outfit.ids)

      if (!yaEsta) {
        const conjunto = {
          nombre: nombreLibre('Outfit de hoy', (delDia || []).map((c) => c.nombre)),
          semana_id: semana.id,
          fecha: hoy,
        }
        const piezas = Object.values(outfit.piezas).filter(Boolean)
        const conRanura = piezas.map((p) => ({ prenda_id: p.id, ranura: huecoDe(p), z_index: RANURAS[huecoDe(p)].capa }))
        let { error } = await supabase.from('conjuntos').insert([{ ...conjunto, conjunto_prenda: conRanura }])
        // Base de datos sin la columna ranura: se guarda igual, sin imantación.
        if (error) ({ error } = await supabase.from('conjuntos').insert([{ ...conjunto, conjunto_prenda: piezas.map((p) => ({ prenda_id: p.id })) }]))
        if (error) throw new Error('No se pudo guardar el outfit')
      }

      const usos = Object.values(outfit.piezas).filter(Boolean)
        .filter((p) => !(p.usos || []).some((u) => u.fecha === hoy))
        .map((p) => ({ prenda_id: p.id, fecha: hoy }))
      if (usos.length) await supabase.from('usos').insert(usos)

      vibrar([40, 40])
      mostrarToast(yaEsta ? 'Ese outfit ya estaba en tu semana; anotado el uso' : 'Outfit de hoy guardado en tu semana', 'exito')
      onHecho?.()
    } catch (e) {
      mostrarToast(e.message || 'No se pudo guardar', 'error')
      setGuardando(null)
    }
  }

  const cargandoTodo = prendas === null || tiempo === 'cargando'
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

      {clima && prendas && propuestas.length === 0 && (
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
