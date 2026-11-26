import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { vibrar } from '../lib/vibrar'
import { leerCache, guardarCache } from '../lib/cache'
import { etiquetaFechaCorta, isoLocal } from '../lib/fechas'
import { borrarArchivo } from '../lib/imagenes'
import Icono from './Icono'
import Miniatura from './Miniatura'

// La caché solo necesita lo que pinta la rejilla, no el árbol de categorías entero.
const resumenPrenda = (p) => ({
  id: p.id,
  nombre: p.nombre,
  imagen_url: p.imagen_url,
  categoria_id: p.categoria_id,
  tipo_id: p.categorias?.tipos?.id || p.tipo_id || null,
  categorias: p.categorias
    ? { nombre: p.categorias.nombre, tipos: p.categorias.tipos ? { id: p.categorias.tipos.id } : null }
    : null,
  usos: Array.isArray(p.usos) ? p.usos.map(u => ({ fecha: u.fecha })) : [],
})

export default function GaleriaArmario({ onCrearConjunto, onEditarPrenda, onAnadirPrenda, onAbrirFiltros, onQuitarFiltro, mostrarToast, filtroCategoria, setDialogoGlobal }) {
  const [prendas, setPrendas] = useState(() => leerCache('prendas') || [])
  const [menuAbierto, setMenuAbierto] = useState(null)
  const [seleccionadas, setSeleccionadas] = useState([])
  const [cargando, setCargando] = useState(() => !leerCache('prendas'))
  const [busqueda, setBusqueda] = useState('')
  const [limiteVisibles, setLimiteVisibles] = useState(24)
  const observadorReferencia = useRef(null)

  useEffect(() => {
    async function obtenerPrendas() {
      let { data } = await supabase
        .from('prendas')
        .select('*, categorias(nombre, tipos(id, nombre)), usos(fecha)')
        .order('creado_en', { ascending: false })

      if (!data) {
        // Base de datos sin la tabla usos: se carga el armario igual.
        ;({ data } = await supabase
          .from('prendas')
          .select('*, categorias(nombre, tipos(id, nombre))')
          .order('creado_en', { ascending: false }))
      }

      if (data) { setPrendas(data); guardarCache('prendas', data.map(resumenPrenda)); }
      setCargando(false)
    }
    obtenerPrendas()
  }, [])

  useEffect(() => { setLimiteVisibles(24) }, [busqueda, filtroCategoria])

  const prendasFiltradas = prendas.filter(prenda => {
    const term = busqueda.toLowerCase()
    const coincideBusqueda = (prenda.nombre || '').toLowerCase().includes(term) || (prenda.categorias?.nombre || '').toLowerCase().includes(term)
    const coincideFiltro = filtroCategoria ? prenda.categoria_id === filtroCategoria.id : true
    return coincideBusqueda && coincideFiltro
  })

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && limiteVisibles < prendasFiltradas.length) {
        setLimiteVisibles(prev => prev + 24)
      }
    }, { threshold: 0.1 })
    if (observadorReferencia.current) observer.observe(observadorReferencia.current)
    return () => observer.disconnect()
  }, [limiteVisibles, prendasFiltradas.length])

  function alternarSeleccion(id) {
    vibrar(30)
    if (seleccionadas.includes(id)) setSeleccionadas(seleccionadas.filter(item => item !== id))
    else setSeleccionadas([...seleccionadas, id])
  }

  async function relacionesDeLaPrenda(prendaId) {
    let { data } = await supabase
      .from('conjunto_prenda')
      .select('conjunto_id, prenda_id, pos_x, pos_y, z_index, ranura')
      .eq('prenda_id', prendaId)
    if (!data) {
      ;({ data } = await supabase
        .from('conjunto_prenda')
        .select('conjunto_id, prenda_id, pos_x, pos_y, z_index')
        .eq('prenda_id', prendaId))
    }
    return data || []
  }

  async function solicitarEliminacionPrenda(prenda, e) {
    e.stopPropagation()
    const relaciones = await relacionesDeLaPrenda(prenda.id)
    const numOutfits = new Set(relaciones.map(r => r.conjunto_id)).size

    setDialogoGlobal({
      mensaje: numOutfits > 0
        ? `¿Eliminar esta prenda? También saldrá de ${numOutfits === 1 ? '1 outfit' : `${numOutfits} outfits`}.`
        : '¿Eliminar esta prenda?',
      esDestructivo: true,
      textoConfirmar: 'Eliminar',
      onConfirm: async () => {
        if (relaciones.length > 0) {
          await supabase.from('conjunto_prenda').delete().eq('prenda_id', prenda.id)
        }
        const { error } = await supabase.from('prendas').delete().eq('id', prenda.id)
        if (error) return mostrarToast('No se pudo eliminar la prenda', 'error')

        const nuevasPrendas = prendas.filter(p => p.id !== prenda.id)
        setPrendas(nuevasPrendas)
        guardarCache('prendas', nuevasPrendas.map(resumenPrenda))
        setSeleccionadas(seleccionadas.filter(sel => sel !== prenda.id))
        vibrar([50, 50])

        // La foto se borra 7 s después. Mientras el aviso siga en pantalla, se puede deshacer.
        let deshecho = false
        mostrarToast('Prenda eliminada', 'info', {
          texto: 'Deshacer',
          onClick: async () => {
            deshecho = true
            const fila = { id: prenda.id, nombre: prenda.nombre, imagen_url: prenda.imagen_url, categoria_id: prenda.categoria_id }
            const { error: errRecuperar } = await supabase.from('prendas').insert([fila])
            if (errRecuperar) return mostrarToast('No se pudo recuperar la prenda', 'error')

            // También vuelven sus outfits y sus usos, no solo la ficha.
            if (relaciones.length > 0) await supabase.from('conjunto_prenda').insert(relaciones)
            const usos = (prenda.usos || [])
              .filter(u => u.fecha)
              .map(u => ({ prenda_id: prenda.id, fecha: u.fecha }))
            if (usos.length > 0) await supabase.from('usos').insert(usos)

            const recuperadas = [prenda, ...nuevasPrendas]
            setPrendas(recuperadas)
            guardarCache('prendas', recuperadas.map(resumenPrenda))
            mostrarToast('Prenda recuperada', 'exito')
          }
        })
        setTimeout(() => { if (!deshecho) borrarArchivo(prenda.imagen_url) }, 7500)
      }
    })
  }

  async function marcarUso(prenda) {
    setMenuAbierto(null)
    const hoy = isoLocal(new Date())
    const { error } = await supabase.from('usos').insert([{ prenda_id: prenda.id, fecha: hoy }])
    if (error) return mostrarToast('No se pudo anotar el uso', 'error')

    const nuevas = prendas.map(p => (
      p.id === prenda.id ? { ...p, usos: [...(p.usos || []), { fecha: hoy }] } : p
    ))
    setPrendas(nuevas)
    guardarCache('prendas', nuevas.map(resumenPrenda))
    vibrar(20)
    mostrarToast('Anotado: te lo has puesto hoy', 'exito')
  }

  function ultimaVez(prenda) {
    const fechas = (prenda.usos || []).map(u => u.fecha).filter(Boolean).sort()
    return fechas.length > 0 ? fechas[fechas.length - 1] : null
  }

  const prendasVisibles = prendasFiltradas.slice(0, limiteVisibles)

  return (
    <div className="flex flex-col flex-1 shrink-0">
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-0 md:max-w-sm">
          <Icono nombre="buscar" className="w-5 h-5 absolute left-3.5 top-3.5 text-tenue pointer-events-none" />
          <input
            type="search"
            autoComplete="off"
            aria-label="Buscar prendas"
            placeholder="Buscar prendas"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="campo pl-11!"
          />
        </div>
        <button onClick={onAbrirFiltros} aria-label="Filtrar por categoría" className="boton-icono w-12! h-12! rounded-xl! bg-lamina">
          <Icono nombre="filtro" />
        </button>
      </div>

      {filtroCategoria && (
        <button onClick={onQuitarFiltro} aria-label={`Quitar el filtro ${filtroCategoria.nombre}`} className="self-start mb-4 min-h-11 max-w-full pl-4 pr-3 rounded-full bg-lamina flex items-center gap-2">
          <span className="truncate">{filtroCategoria.nombre}</span>
          <Icono nombre="cerrar" className="w-5 h-5 shrink-0" />
        </button>
      )}

      {cargando ? (
        <div className="rejilla" role="status" aria-label="Cargando prendas">
          {[...Array(6)].map((_, i) => (
            <div key={i}>
              <div className="esqueleto aspect-4/5" />
              <div className="h-12 mt-2 flex flex-col justify-center gap-2"><div className="esqueleto h-3 w-2/3" /><div className="esqueleto h-3 w-1/3" /></div>
            </div>
          ))}
        </div>
      ) : prendasFiltradas.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-center">
          <Icono nombre="percha" className="w-12 h-12 text-tenue" />
          <p className="text-xl font-bold">{prendas.length === 0 ? 'Aún no hay prendas' : 'No hay prendas que coincidan'}</p>
          {prendas.length === 0 && (
            <>
              <p className="text-tenue max-w-xs">Empieza por la que más te pones. La foto se recorta sola.</p>
              <button onClick={onAnadirPrenda} className="boton boton-primario mt-2">Añadir una prenda</button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="rejilla mb-4">
            {prendasVisibles.map((prenda) => {
              const seleccionada = seleccionadas.includes(prenda.id)
              const nombre = prenda.nombre || 'Sin nombre'
              return (
                <article key={prenda.id} className="min-w-0">
                  <div className="relative">
                    <button
                      onClick={() => alternarSeleccion(prenda.id)}
                      aria-pressed={seleccionada}
                      aria-label={`Seleccionar ${nombre}`}
                      className={`block w-full aspect-4/5 rounded-xl bg-foto overflow-hidden border-2 ${seleccionada ? 'border-acento' : 'border-transparent'}`}
                    >
                      <Miniatura url={prenda.imagen_url} alt={nombre} className="w-full h-full object-contain p-3 md:p-4" />
                    </button>
                    {seleccionada && (
                      <span className="aparece pointer-events-none absolute top-2 left-2 w-7 h-7 rounded-full bg-acento text-sobre-acento flex items-center justify-center">
                        <Icono nombre="marca" className="w-4 h-4" />
                      </span>
                    )}
                    {menuAbierto === prenda.id && (
                      <div className="aparece absolute inset-0 rounded-xl bg-velo flex flex-col justify-end gap-2 p-2" onClick={() => setMenuAbierto(null)} onKeyDown={(e) => { if (e.key === 'Escape') setMenuAbierto(null) }}>
                        <button onClick={() => marcarUso(prenda)} aria-label={`Anotar que hoy te has puesto ${nombre}`} className="boton boton-secundario">Me lo he puesto</button>
                        <button autoFocus onClick={() => { setMenuAbierto(null); onEditarPrenda(prenda) }} aria-label={`Editar ${nombre}`} className="boton boton-secundario">Editar</button>
                        <button onClick={(e) => { setMenuAbierto(null); solicitarEliminacionPrenda(prenda, e) }} aria-label={`Eliminar ${nombre}`} className="boton boton-peligro">Eliminar</button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center mt-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-6 truncate">{nombre}</p>
                      <p className="text-sm leading-6 text-tenue truncate">{prenda.categorias?.nombre || 'Sin categoría'}</p>
                      {ultimaVez(prenda) && (
                        <p className="text-xs leading-5 text-tenue truncate">Usada el {etiquetaFechaCorta(ultimaVez(prenda))}</p>
                      )}
                    </div>
                    <button onClick={() => setMenuAbierto(menuAbierto === prenda.id ? null : prenda.id)} aria-label={`Opciones de ${nombre}`} aria-expanded={menuAbierto === prenda.id} className="boton-icono -mr-2 text-tenue">
                      <Icono nombre="puntos" />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
          {limiteVisibles < prendasFiltradas.length && (
            <div ref={observadorReferencia} className="w-full h-10 my-4 flex justify-center items-center">
              <div className="w-5 h-5 border-2 border-linea border-t-tinta rounded-full animate-spin"></div>
            </div>
          )}
        </>
      )}

      {seleccionadas.length > 0 ? (
        <div className="aparece sticky bottom-0 md:bottom-4 z-20 mt-auto flex items-center gap-2 rounded-2xl bg-superficie p-2 shadow-(--sombra) md:self-center">
          <button onClick={() => setSeleccionadas([])} aria-label="Quitar la selección" className="boton-icono">
            <Icono nombre="cerrar" />
          </button>
          <button onClick={() => onCrearConjunto(seleccionadas)} className="boton boton-primario flex-1 min-w-0 md:px-8">
            {`Crear outfit con ${seleccionadas.length} ${seleccionadas.length === 1 ? 'prenda' : 'prendas'}`}
          </button>
        </div>
      ) : !cargando && prendas.length > 0 && (
        <button onClick={onAnadirPrenda} className="accion boton boton-primario">
          <Icono nombre="mas" className="w-5 h-5" />
          Añadir prenda
        </button>
      )}
    </div>
  )
}
