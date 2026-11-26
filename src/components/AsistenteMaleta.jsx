import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { crearCapsula, diasDelViaje, extrasDeViaje } from '../lib/capsula'
import { leerChecklist, anadirExtras } from '../lib/checklistMaleta'
import { paisDeCasa, previsionViaje } from '../lib/clima'
import { desdeISO, etiquetaDia, isoLocal } from '../lib/fechas'
import { nombreLibre } from '../lib/nombres'
import { esDuplicado } from '../lib/outfits'
import { RANURAS } from '../lib/maniqui'
import { OCASIONES_VIAJE, huecoDe } from '../lib/sugerir'
import { vibrar } from '../lib/vibrar'
import { usePrendas } from '../lib/almacen'
import LienzoOutfit from './LienzoOutfit'

const MANUAL = [
  { id: 'frio', etiqueta: 'Frío', clima: { temp: 4, min: 0, max: 8, lluvia: false } },
  { id: 'fresco', etiqueta: 'Fresco', clima: { temp: 13, min: 9, max: 17, lluvia: false } },
  { id: 'templado', etiqueta: 'Templado', clima: { temp: 20, min: 15, max: 25, lluvia: false } },
  { id: 'calor', etiqueta: 'Calor', clima: { temp: 30, min: 24, max: 35, lluvia: false } },
]

const chip = (activo) =>
  `shrink-0 min-h-11 px-4 rounded-full border text-sm font-medium whitespace-nowrap ${activo ? 'bg-acento text-sobre-acento border-acento' : 'bg-superficie border-linea text-tinta'}`

function comoConjunto(outfit) {
  return {
    id: `cap-${outfit.fecha}`,
    conjunto_prenda: Object.values(outfit.piezas).filter(Boolean).map((p) => {
      const ranura = huecoDe(p)
      return { conjunto_id: 'cap', prenda_id: p.id, ranura, z_index: RANURAS[ranura].capa, pos_x: 0, pos_y: 0, prendas: p }
    }),
  }
}

/** Asistente que prepara la maleta: un outfit distinto por día con las menos prendas posibles. */
export default function AsistenteMaleta({ maleta, mostrarToast, onHecho }) {
  const fechas = useMemo(() => diasDelViaje(maleta.fecha_inicio, maleta.fecha_fin), [maleta])
  const { prendas, cargando: cargandoPrendas } = usePrendas()
  const [prevision, setPrevision] = useState('cargando') // 'cargando' | null | { dias, nombre, pais }
  const [manual, setManual] = useState(null)
  const [ocasiones, setOcasiones] = useState({})
  const [maxZapatos, setMaxZapatos] = useState(2)
  const [semilla, setSemilla] = useState(0)
  const [resultado, setResultado] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const destino = (maleta.destino || maleta.nombre || '').replace(/[0-9]/g, '').trim()
  const anclaResultado = useRef(null)

  useEffect(() => {
    let vivo = true
    previsionViaje({ destino, fechas, hoy: isoLocal(new Date()) }).then((p) => { if (vivo) setPrevision(p) })
    return () => { vivo = false }
  }, [destino, fechas])

  const dias = useMemo(() => {
    const porFecha = new Map((prevision && prevision !== 'cargando' ? prevision.dias : []).map((d) => [d.fecha, d]))
    return fechas
      .map((fecha) => {
        const d = porFecha.get(fecha)
        const clima = manual?.clima || d
        return clima ? { fecha, clima, estimado: !manual && d?.estimado, ocasion: ocasiones[fecha] || 'cualquiera' } : null
      })
      .filter(Boolean)
  }, [fechas, prevision, manual, ocasiones])

  const sinTiempo = prevision !== 'cargando' && prevision === null && !manual

  function preparar(nuevaSemilla = semilla) {
    vibrar(15)
    const r = crearCapsula(prendas, dias, { maxZapatos, semilla: nuevaSemilla })
    setResultado(r)
    requestAnimationFrame(() => anclaResultado.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const otraCapsula = () => { const s = semilla + 1; setSemilla(s); preparar(s) }

  async function guardar() {
    setGuardando(true)
    try {
      const { data } = await supabase.from('conjuntos').select('id, nombre, conjunto_prenda(prenda_id)').eq('maleta_id', maleta.id)
      const existentes = data || []
      const nombres = existentes.map((c) => c.nombre)
      let creados = 0
      let repetidos = 0

      for (const [i, o] of resultado.outfits.entries()) {
        if (esDuplicado(existentes, o.ids)) { repetidos++; continue }
        const nombre = nombreLibre(`Día ${i + 1} · ${etiquetaDia(desdeISO(o.fecha))}`, nombres)
        nombres.push(nombre)
        const piezas = Object.values(o.piezas).filter(Boolean)
        const base = { nombre, maleta_id: maleta.id, fecha: o.fecha }
        const { error } = await supabase.from('conjuntos').insert([{
          ...base, conjunto_prenda: piezas.map((p) => ({ prenda_id: p.id, ranura: huecoDe(p), z_index: RANURAS[huecoDe(p)].capa })),
        }])
        if (error) throw new Error('No se pudo guardar un outfit')
        creados++
        existentes.push({ id: null, nombre, conjunto_prenda: piezas.map((p) => ({ prenda_id: p.id })) })
      }

      // Lo que no es ropa, a la lista de la maleta.
      const actual = await leerChecklist(supabase, maleta.id)
      if (actual.error) throw new Error(actual.error)
      const extras = extrasDeViaje({
        dias, paisDestino: prevision && prevision !== 'cargando' ? prevision.pais : null, paisOrigen: paisDeCasa(),
      })
      const nuevos = await anadirExtras(supabase, maleta.id, extras, { extras: actual.extras })

      vibrar([40, 40])
      mostrarToast(`Maleta preparada: ${creados} outfits y ${nuevos?.length ?? 0} cosas en la lista${repetidos ? ` (${repetidos} ya estaban)` : ''}`, 'exito')
      onHecho?.()
    } catch (e) {
      mostrarToast(e.message || 'No se pudo guardar', 'error')
      setGuardando(false)
    }
  }

  const cargando = cargandoPrendas || prevision === 'cargando'

  return (
    <div className="flex flex-col gap-4 text-left">
      <h2 className="titulo-hoja">Prepara «{maleta.nombre}»</h2>

      {cargando && <div role="status" aria-label="Consultando el tiempo" className="esqueleto h-40 w-full" />}

      {!cargando && sinTiempo && (
        <div className="flex flex-col gap-2">
          <p className="text-tenue">No he podido consultar el tiempo de {destino || 'tu destino'}. ¿Cómo hará?</p>
          <div className="flex flex-wrap gap-2">
            {MANUAL.map((m) => <button key={m.id} onClick={() => setManual(m)} className={chip(false)}>{m.etiqueta}</button>)}
          </div>
        </div>
      )}

      {!cargando && dias.length > 0 && (
        <>
          <p className="text-tenue -mt-2">
            {dias.length} {dias.length === 1 ? 'día' : 'días'}
            {manual ? ` · tiempo ${manual.etiqueta.toLowerCase()} todos los días` : prevision?.nombre ? ` en ${prevision.nombre}` : ''}
            {dias.some((d) => d.estimado) && ' · lo marcado con ≈ es la media del año pasado'}
          </p>

          <ul className="rounded-xl border border-linea divide-y divide-linea">
            {dias.map((d) => (
              <li key={d.fecha} className="flex items-center gap-2 pl-3 pr-2 min-h-12">
                <span className="w-16 shrink-0 text-sm font-semibold">{etiquetaDia(desdeISO(d.fecha))}</span>
                <span className="flex-1 min-w-0 text-sm text-tenue truncate">
                  {d.estimado && '≈ '}{Math.round(d.clima.min)}°–{Math.round(d.clima.max)}°{d.clima.lluvia && ' · lluvia'}
                </span>
                <select aria-label={`Plan del ${etiquetaDia(desdeISO(d.fecha))}`} value={d.ocasion} onChange={(e) => setOcasiones((o) => ({ ...o, [d.fecha]: e.target.value }))} className="campo min-h-10! w-auto! py-1! text-sm">
                  <option value="cualquiera">Normal</option>
                  {Object.entries(OCASIONES_VIAJE).map(([id, o]) => <option key={id} value={id}>{o.etiqueta}</option>)}
                </select>
              </li>
            ))}
          </ul>

          <div>
            <span className="etiqueta">Pares de zapatos como mucho</span>
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => <button key={n} onClick={() => setMaxZapatos(n)} aria-pressed={maxZapatos === n} className={chip(maxZapatos === n)}>{n}</button>)}
            </div>
          </div>

          <button onClick={() => preparar()} disabled={prendas.length === 0} className="boton boton-primario w-full">
            {resultado ? 'Volver a prepararla' : 'Preparar la maleta'}
          </button>
          {prendas.length === 0 && <p className="text-sm text-tenue">Primero añade prendas al armario.</p>}
        </>
      )}

      {resultado && (
        <div ref={anclaResultado} className="flex flex-col gap-3 scroll-mt-2">
          {resultado.outfits.length === 0 ? (
            <p className="py-6 text-center text-tenue">Con tu armario no he podido montar ningún outfit. Hace falta al menos una prenda de arriba y otra de abajo (o un vestido).</p>
          ) : (
            <>
              <p className="text-lg font-bold">{resultado.resumen.prendas} prendas → {resultado.resumen.outfits} outfits</p>
              {resultado.resumen.repetidos > 0 && (
                <p className="text-sm text-tenue">Tu armario no da para {resultado.resumen.outfits} combinaciones distintas: {resultado.resumen.repetidos} outfits se repiten.</p>
              )}
              {resultado.sinOutfit.length > 0 && <p className="text-sm text-peligro">Sin outfit el {resultado.sinOutfit.length === 1 ? 'día' : 'los días'} {resultado.sinOutfit.map((f) => etiquetaDia(desdeISO(f))).join(', ')}.</p>}

              <div className="grid grid-cols-2 gap-2">
                {resultado.outfits.map((o) => (
                  <figure key={o.fecha} className="rounded-xl border border-linea bg-superficie overflow-hidden [content-visibility:auto] [contain-intrinsic-size:auto_220px]">
                    <LienzoOutfit conjunto={comoConjunto(o)} soloLectura />
                    <figcaption className="px-2 py-1.5 text-sm font-semibold">{etiquetaDia(desdeISO(o.fecha))}{o.repetido && <span className="text-tenue font-normal"> · repetido</span>}</figcaption>
                  </figure>
                ))}
              </div>

              <div className="flex gap-2">
                <button onClick={otraCapsula} disabled={guardando} className="boton boton-secundario flex-1">Otra maleta</button>
                <button onClick={guardar} disabled={guardando} className="boton boton-primario flex-1">{guardando ? 'Guardando…' : 'Guardar en la maleta'}</button>
              </div>
              <p className="text-xs text-tenue">Los outfits se guardan como los demás: podrás cambiarlos. También se añade a la lista lo que no es ropa.</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
