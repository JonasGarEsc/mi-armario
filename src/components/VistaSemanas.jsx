import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { leerCache, guardarCache } from '../lib/cache'
import {
  DIAS, desdeISO, diasDeSemana, etiquetaDia, etiquetaRango, isoLocal, mismoDia,
} from '../lib/fechas'
import { nombreLibre } from '../lib/nombres'
import { generarPng } from '../lib/exportar'
import { compartirConAviso } from '../lib/compartirUi'
import { vibrar } from '../lib/vibrar'
import { guardarEstadoPrenda } from '../lib/estadoPrenda'
import BotonQueMePongo from './BotonQueMePongo'
import Icono from './Icono'
import LienzoOutfit from './LienzoOutfit'

const CONSULTA_CONJUNTOS = 'id, nombre, fecha, conjunto_prenda(*, prendas(*, categorias(nombre, tipos(nombre))))'
const CONSULTA_SIN_RANURA = 'id, nombre, fecha, conjunto_prenda(conjunto_id, prenda_id, pos_x, pos_y, z_index, prendas(*, categorias(nombre, tipos(nombre))))'

export default function VistaSemanas({ activa = false, recarga = 0, onCrearSemana, onQueMePongo, onAnadirOutfit, mostrarToast, setDialogoGlobal }) {
  const [semanas, setSemanas] = useState(() => leerCache('semanas') || [])
  const [cargando, setCargando] = useState(() => !leerCache('semanas'))
  const [errorBase, setErrorBase] = useState('')
  const [semanaActiva, setSemanaActiva] = useState(null)
  const [conjuntos, setConjuntos] = useState([])
  const [diaActivo, setDiaActivo] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null)
  const [refresco, setRefresco] = useState(0)

  useEffect(() => {
    // La pestaña se monta al arrancar, pero no se consulta hasta que se abre:
    // así, si acabas de ejecutar el SQL, la primera lectura ya lo encuentra.
    if (!activa) return undefined
    let vivo = true

    async function cargar() {
      if (!semanaActiva) {
        const cache = leerCache('semanas')
        if (cache) {
          setSemanas(cache)
          setCargando(false)
        }

        const { data: filas, error } = await supabase
          .from('semanas')
          .select('*')
          .order('fecha_inicio', { ascending: false })

        if (!vivo) return
        if (error) {
          setErrorBase(`No se pudo leer la tabla «semanas»: ${error.message}`)
          setCargando(false)
          return
        }

        // Sin depender de la relación de PostgREST: dos consultas y se juntan aquí.
        const { data: citas, error: errCitas } = await supabase
          .from('conjuntos')
          .select('id, fecha, semana_id')
          .not('semana_id', 'is', null)

        if (!vivo) return

        const porSemana = new Map()
        for (const c of citas || []) {
          if (!porSemana.has(c.semana_id)) porSemana.set(c.semana_id, [])
          porSemana.get(c.semana_id).push({ id: c.id, fecha: c.fecha })
        }

        const lista = (filas || []).map(s => ({ ...s, conjuntos: porSemana.get(s.id) || [] }))
        setSemanas(lista)
        guardarCache('semanas', lista)
        setErrorBase(errCitas
          ? `Las semanas se leen, pero falta algo en conjuntos: ${errCitas.message}`
          : '')
        setCargando(false)
        return
      }

      const clave = `semana_${semanaActiva.id}`
      const cache = leerCache(clave)
      if (cache) {
        setConjuntos(cache)
        setCargando(false)
      } else {
        setCargando(true)
      }

      let { data } = await supabase
        .from('conjuntos')
        .select(CONSULTA_CONJUNTOS)
        .eq('semana_id', semanaActiva.id)
        .order('nombre')

      if (!data) {
        // Base de datos sin la columna ranura: se carga igual, sin imantación.
        ;({ data } = await supabase
          .from('conjuntos')
          .select(CONSULTA_SIN_RANURA)
          .eq('semana_id', semanaActiva.id)
          .order('nombre'))
      }

      if (!vivo) return
      if (data) {
        setConjuntos(data)
        guardarCache(clave, data)
      }
      setCargando(false)
    }

    cargar()
    return () => { vivo = false }
  }, [semanaActiva, recarga, refresco, activa])

  useEffect(() => {
    if (!semanaActiva) return
    const dias = diasDeSemana(desdeISO(semanaActiva.fecha_inicio))
    setDiaActivo((actual) => {
      if (actual && dias.some((d) => isoLocal(d) === actual)) return actual
      const hoy = new Date()
      return isoLocal(dias.find((d) => mismoDia(d, hoy)) || dias[0])
    })
  }, [semanaActiva])

  function abrirSemana(semana) {
    vibrar(20)
    setConjuntos(leerCache(`semana_${semana.id}`) || [])
    setCargando(!leerCache(`semana_${semana.id}`))
    setBusqueda('')
    setSemanaActiva(semana)
  }

  function volver() {
    vibrar(20)
    setSemanaActiva(null)
    setConjuntos([])
    setDiaActivo(null)
    setBusqueda('')
    setCargando(!leerCache('semanas'))
  }

  async function guardarNombre() {
    if (!editando) return
    const { tipo, id, valor } = editando
    setEditando(null)
    const nombre = valor.trim()
    if (!nombre) return

    if (tipo === 'semana') {
      if (semanaActiva?.id !== id) return
      const anterior = semanaActiva.nombre
      if (anterior === nombre) return

      // Primero se pinta el nombre nuevo y luego se guarda.
      setSemanaActiva({ ...semanaActiva, nombre })
      const lista = semanas.map((s) => (s.id === id ? { ...s, nombre } : s))
      setSemanas(lista)
      guardarCache('semanas', lista)

      const { error } = await supabase.from('semanas').update({ nombre }).eq('id', id)
      if (error) {
        setSemanaActiva({ ...semanaActiva, nombre: anterior })
        const antes = semanas.map((s) => (s.id === id ? { ...s, nombre: anterior } : s))
        setSemanas(antes)
        guardarCache('semanas', antes)
        return mostrarToast('No se pudo cambiar el nombre', 'error')
      }
      mostrarToast('Nombre cambiado', 'exito')
      return
    }

    const anterior = conjuntos.find((c) => c.id === id)
    if (!anterior || anterior.nombre === nombre) return

    setConjuntos((lista) => lista.map((c) => (c.id === id ? { ...c, nombre } : c)))
    guardarCache(`semana_${semanaActiva.id}`, conjuntos.map((c) => (c.id === id ? { ...c, nombre } : c)))

    const { error } = await supabase.from('conjuntos').update({ nombre }).eq('id', id)
    if (error) {
      setConjuntos((lista) => lista.map((c) => (c.id === id ? { ...c, nombre: anterior.nombre } : c)))
      guardarCache(`semana_${semanaActiva.id}`, conjuntos.map((c) => (c.id === id ? { ...c, nombre: anterior.nombre } : c)))
      return mostrarToast('Ese nombre ya existe ese día', 'error')
    }
    mostrarToast('Nombre cambiado', 'exito')
  }

  function nombreEditable(tipo, id, nombre, clases) {
    if (editando?.tipo === tipo && editando.id === id) {
      return (
        <input
          value={editando.valor}
          autoFocus
          aria-label="Nuevo nombre"
          onChange={(e) => setEditando({ ...editando, valor: e.target.value })}
          onBlur={guardarNombre}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
            if (e.key === 'Escape') setEditando(null)
          }}
          className={`${clases} w-full min-w-0 bg-transparent border-b-2 border-acento`}
        />
      )
    }
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setEditando({ tipo, id, valor: nombre }) }}
        title="Cambiar nombre"
        className={`${clases} truncate text-left`}
      >
        {nombre}
      </button>
    )
  }

  function eliminarSemana() {
    if (!semanaActiva) return
    const semana = semanaActiva
    setDialogoGlobal({
      mensaje: `¿Eliminar «${semana.nombre}»? Se borrarán sus outfits.`,
      esDestructivo: true,
      textoConfirmar: 'Eliminar',
      onConfirm: async () => {
        // La base borra en cascada los outfits y las prendas de estos.
        const { error } = await supabase.from('semanas').delete().eq('id', semana.id)
        if (error) return mostrarToast('No se pudo eliminar la semana', 'error')
        const lista = semanas.filter((s) => s.id !== semana.id)
        setSemanas(lista)
        guardarCache('semanas', lista)
        guardarCache(`semana_${semana.id}`, [])
        vibrar([50, 50])
        volver()
        mostrarToast('Semana eliminada', 'info')
      },
    })
  }

  function eliminarOutfit(conjunto) {
    setDialogoGlobal({
      mensaje: `¿Eliminar «${conjunto.nombre}»?`,
      esDestructivo: true,
      textoConfirmar: 'Eliminar',
      onConfirm: async () => {
        // La base borra en cascada las prendas del outfit.
        const { error } = await supabase.from('conjuntos').delete().eq('id', conjunto.id)
        if (error) return mostrarToast('No se pudo eliminar el outfit', 'error')
        const nuevos = conjuntos.filter((c) => c.id !== conjunto.id)
        setConjuntos(nuevos)
        guardarCache(`semana_${semanaActiva.id}`, nuevos)
        vibrar([50, 50])
        mostrarToast('Outfit eliminado', 'info')
      },
    })
  }

  async function clonarOutfit(conjunto) {
    const delDia = conjuntos.filter((c) => c.fecha === conjunto.fecha)
    const nombre = nombreLibre(`${conjunto.nombre} (Copia)`, delDia.map((c) => c.nombre))
    const { error } = await supabase.from('conjuntos').insert([{
      nombre,
      semana_id: semanaActiva.id,
      fecha: conjunto.fecha,
      conjunto_prenda: (conjunto.conjunto_prenda || []).map((cp) => ({
        prenda_id: cp.prenda_id,
        pos_x: cp.pos_x,
        pos_y: cp.pos_y,
        z_index: cp.z_index,
        ranura: cp.ranura || null,
      })),
    }])
    if (error) return mostrarToast('No se pudo duplicar el outfit', 'error')
    vibrar([50, 50])
    mostrarToast('Outfit duplicado', 'exito')
    setRefresco((n) => n + 1)
  }

  async function actualizarEstado(conjuntoId, prendaId, x, y, z, ranura, extra) {
    const ok = await guardarEstadoPrenda(supabase, { conjuntoId, prendaId, x, y, z, ranura, extra })
    if (!ok) mostrarToast('No se pudo guardar la posición', 'error')
  }


  function exportarOutfit(conjunto) {
    return compartirConAviso({
      generar: () => generarPng(conjunto.id, conjunto.nombre),
      nombre: conjunto.nombre,
      titulo: `Outfit: ${conjunto.nombre}`,
      mostrarToast,
    })
  }


  const dias = semanaActiva ? diasDeSemana(desdeISO(semanaActiva.fecha_inicio)) : []
  const diaElegido = diaActivo || (dias[0] ? isoLocal(dias[0]) : null)
  const conjuntosDelDia = diaElegido ? conjuntos.filter((c) => c.fecha === diaElegido) : []
  const visibles = conjuntosDelDia.filter((c) => c.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  const semanasFiltradas = semanas.filter((s) => s.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  const outfitsDelDia = (iso) => conjuntos.some((c) => c.fecha === iso)

  return (
    <div className={`flex flex-col flex-1 shrink-0 ${semanaActiva ? 'entra' : ''}`}>
      {semanaActiva ? (
        <div className="mb-2">
          <div className="flex items-center gap-1 min-h-12">
            <button onClick={volver} aria-label="Volver a las semanas" className="boton-icono -ml-3">
              <Icono nombre="volver" />
            </button>
            <h2 className="flex-1 min-w-0 flex">
              {nombreEditable('semana', semanaActiva.id, semanaActiva.nombre, 'min-h-11 max-w-full text-2xl md:text-3xl font-bold tracking-tight')}
            </h2>
            <button onClick={eliminarSemana} aria-label={`Eliminar ${semanaActiva.nombre}`} className="boton-icono -mr-2">
              <Icono nombre="borrar" />
            </button>
          </div>
          <p className="text-sm text-tenue mb-4">
            {etiquetaRango(semanaActiva.fecha_inicio, semanaActiva.fecha_fin)} · {conjuntos.length === 1 ? '1 outfit' : `${conjuntos.length} outfits`}
          </p>

          <div data-sin-swipe className="-mx-1 px-1 flex gap-1.5 overflow-x-auto sin-barra pb-1 mb-4">
            {dias.map((dia, i) => {
              const iso = isoLocal(dia)
              const activo = iso === diaElegido
              const lleno = outfitsDelDia(iso)
              return (
                <button
                  key={iso}
                  onClick={() => { setDiaActivo(iso); vibrar(10) }}
                  aria-pressed={activo}
                  aria-label={`Ver ${etiquetaDia(dia)}`}
                  className={`shrink-0 min-w-14 min-h-15 rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs ${
                    activo ? 'bg-acento text-sobre-acento font-semibold' : 'bg-lamina text-tinta'
                  }`}
                >
                  <span className="uppercase tracking-wide">{DIAS[i]}</span>
                  <span className="text-base font-bold leading-none">{dia.getDate()}</span>
                  <span className={`w-1 h-1 rounded-full ${lleno ? (activo ? 'bg-sobre-acento' : 'bg-acento') : 'bg-transparent'}`} />
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <>
          <h2 className="max-md:sr-only shrink-0 text-3xl font-bold tracking-tight min-h-12 mb-5">Semana</h2>
          <BotonQueMePongo onClick={onQueMePongo} className="mb-4 md:self-start" />
        </>
      )}

      {errorBase && !semanaActiva && (
        <div role="alert" className="aviso-error mb-4 flex flex-col items-start gap-2">
          <p className="wrap-break-word">{errorBase}</p>
          <button
            onClick={() => setRefresco(n => n + 1)}
            className="min-h-9 font-semibold underline underline-offset-4"
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="relative mb-4 md:max-w-sm">
        <Icono nombre="buscar" className="w-5 h-5 absolute left-3.5 top-3.5 text-tenue pointer-events-none" />
        <input
          type="search"
          autoComplete="off"
          aria-label="Buscar"
          placeholder={semanaActiva ? 'Buscar outfit' : 'Buscar semana'}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="campo pl-11!"
        />
      </div>

      {cargando ? (
        <div role="status" aria-label="Cargando" className={semanaActiva ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5' : 'grid grid-cols-1 md:grid-cols-2 gap-3'}>
          {[0, 1, 2].map((i) => <div key={i} className={semanaActiva ? 'esqueleto aspect-square' : 'esqueleto h-28'} />)}
        </div>
      ) : !semanaActiva ? (
        semanasFiltradas.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Icono nombre="calendario" className="w-12 h-12 text-tenue" />
            <p className="text-xl font-bold">{busqueda ? 'Nada coincide con la búsqueda' : 'Todavía no hay semanas'}</p>
            {!busqueda && <p className="text-tenue max-w-xs">Elige un día y tendrás la semana entera lista para montar outfits.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {semanasFiltradas.map((semana) => {
              const total = semana.conjuntos?.length || 0
              return (
                <button
                  key={semana.id}
                  onClick={() => abrirSemana(semana)}
                  className="min-w-0 text-left rounded-2xl border border-linea bg-superficie p-4"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-semibold truncate">{semana.nombre}</span>
                      <span className="block text-sm text-tenue">{etiquetaRango(semana.fecha_inicio, semana.fecha_fin)}</span>
                    </span>
                    <span className="shrink-0 text-sm text-tenue">{total === 1 ? '1 outfit' : `${total} outfits`}</span>
                  </span>
                  <span className="mt-3 grid grid-cols-7 gap-1">
                    {diasDeSemana(desdeISO(semana.fecha_inicio)).map((dia) => (
                      <span
                        key={isoLocal(dia)}
                        title={etiquetaDia(dia)}
                        className={`h-1.5 rounded-full ${(semana.conjuntos || []).some((c) => c.fecha === isoLocal(dia)) ? 'bg-acento' : 'bg-linea'}`}
                      />
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        )
      ) : visibles.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-center">
          <Icono nombre="calendario" className="w-12 h-12 text-tenue" />
          <p className="text-xl font-bold">{busqueda ? 'Nada coincide con la búsqueda' : `Nada para el ${etiquetaDia(diaElegido)}`}</p>
          {!busqueda && <p className="text-tenue max-w-xs">Añade un outfit con las prendas del armario.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-4">
          {visibles.map((conjunto) => (
            <article key={conjunto.id} className="min-w-0 rounded-xl border border-linea bg-superficie overflow-hidden isolate">
              <div className="flex items-center pl-4 pr-1 h-14 border-b border-linea">
                <h3 className="flex-1 min-w-0 flex">
                  {nombreEditable('outfit', conjunto.id, conjunto.nombre, 'min-h-11 max-w-full text-lg font-semibold')}
                </h3>
                <button onClick={() => exportarOutfit(conjunto)} aria-label={`Compartir imagen de ${conjunto.nombre}`} className="boton-icono">
                  <Icono nombre="compartir" className="w-5 h-5" />
                </button>
                <button onClick={() => clonarOutfit(conjunto)} aria-label={`Duplicar ${conjunto.nombre}`} className="boton-icono">
                  <Icono nombre="duplicar" className="w-5 h-5" />
                </button>
                <button onClick={() => eliminarOutfit(conjunto)} aria-label={`Eliminar ${conjunto.nombre}`} className="boton-icono">
                  <Icono nombre="borrar" className="w-5 h-5" />
                </button>
              </div>
              <LienzoOutfit conjunto={conjunto} onGuardarEstado={actualizarEstado} />
            </article>
          ))}
        </div>
      )}

      {!cargando && (
        <button
          onClick={() => {
            if (semanaActiva) onAnadirOutfit(semanaActiva, diaElegido)
            else onCrearSemana()
          }}
          className="accion boton boton-primario"
        >
          <Icono nombre="mas" className="w-5 h-5" />
          {semanaActiva ? `Añadir outfit del ${etiquetaDia(diaElegido)}` : 'Nueva semana'}
        </button>
      )}
    </div>
  )
}
