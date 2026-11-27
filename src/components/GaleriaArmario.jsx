import { useState, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { supabase } from '../supabase'
import { vibrar } from '../lib/vibrar'
import { etiquetaFechaCorta, isoLocal } from '../lib/fechas'
import { PUNTO_FAMILIA } from '../lib/colores'
import { escribir } from '../lib/offline'
import {
  FAMILIAS_COLOR, GRUPOS_FORMALIDAD, TEMPORADAS, filtrarPrendas, hayFiltros, sinFiltros, ultimaVez,
} from '../lib/filtros'
import { borrarArchivo } from '../lib/imagenes'
import { nombreVistaPrenda, conTransicionVista } from '../lib/transicionVista'
import { usePulsacionLarga } from '../lib/usePulsacionLarga'
import {
  actualizarPrenda, confirmarBorradoPrenda, conservarPrenda, ocultarPrenda, quitarPrenda, reponerPrenda, usePrendas,
} from '../lib/almacen'
import BotonQueMePongo from './BotonQueMePongo'
import EstadoVacio from './EstadoVacio'
import Icono from './Icono'
import ListaDeseos from './ListaDeseos'
import Miniatura from './Miniatura'

const chipFiltro = (activo) =>
  `shrink-0 min-h-11 px-4 rounded-[10px] border text-sm font-medium whitespace-nowrap ${activo ? 'bg-acento text-sobre-acento border-acento' : 'bg-superficie border-linea text-tinta'}`

// Una tarjeta del armario. Un toque abre la ficha; la pulsación larga (o el clic
// derecho) abre el menú de siempre. En modo selección, el toque sigue marcando.
function TarjetaPrenda({
  prenda, seleccionada, enSeleccion, menuAbierto,
  onAbrirMenu, onCerrarMenu, onSeleccionar, onAbrirFicha, onMarcarUso, onEditar, onEliminar,
}) {
  const nombre = prenda.nombre || 'Sin nombre'
  const foto = useRef(null)
  const pulsacion = usePulsacionLarga(() => { vibrar(30); onAbrirMenu() })

  function alPulsarFoto(e) {
    // La pulsación larga ya abrió el menú: el clic que llega después no cuenta
    // (los clics de teclado tienen detail 0 y no pasan por esta comprobación).
    if (e?.detail !== 0 && pulsacion.consumirClic()) return
    if (enSeleccion) onSeleccionar()
    else onAbrirFicha(prenda, foto.current)
  }

  return (
    <article className="min-w-0" onContextMenu={(e) => { e.preventDefault(); pulsacion.cancelar(); onAbrirMenu() }}>
      <div className="relative">
        <button
          onClick={alPulsarFoto}
          onPointerDown={pulsacion.iniciar}
          onPointerMove={pulsacion.mover}
          onPointerUp={pulsacion.soltar}
          onPointerCancel={pulsacion.cancelar}
          aria-pressed={enSeleccion ? seleccionada : undefined}
          aria-label={enSeleccion
            ? `${seleccionada ? 'Quitar de la selección' : 'Seleccionar'} ${nombre}`
            : `Abrir la ficha de ${nombre}`}
          className={`block w-full aspect-4/5 rounded-xl bg-foto overflow-hidden border-2 select-none [-webkit-touch-callout:none] ${seleccionada ? 'border-acento' : 'border-transparent'}`}
        >
          <span ref={foto} className="block w-full h-full">
            <Miniatura url={prenda.imagen_url} alt={nombre} className="w-full h-full object-contain p-3 md:p-4" />
          </span>
        </button>
        <button
          type="button"
          onClick={onSeleccionar}
          aria-pressed={seleccionada}
          aria-label={`${seleccionada ? 'Quitar de la selección' : 'Seleccionar'} ${nombre}`}
          className="absolute top-0.5 right-0.5 z-10 w-11 h-11 flex items-center justify-center"
        >
          <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${seleccionada ? 'bg-acento border-acento text-sobre-acento' : 'bg-superficie/90 border-linea text-tenue'}`}>
            <Icono nombre={seleccionada ? 'marca' : 'mas'} className="w-4 h-4" />
          </span>
        </button>
        {menuAbierto && (
          <div className="aparece absolute inset-0 z-20 rounded-xl bg-velo flex flex-col justify-end gap-2 p-2" onPointerDown={pulsacion.consumirClic} onClickCapture={(e) => { if (e.detail !== 0 && pulsacion.consumirClic()) { e.preventDefault(); e.stopPropagation() } }} onClick={onCerrarMenu} onKeyDown={(e) => { if (e.key === 'Escape') onCerrarMenu() }}>
            <button onClick={() => { onCerrarMenu(); onMarcarUso() }} aria-label={`Anotar que hoy te has puesto ${nombre}`} className="boton boton-secundario">Me lo he puesto</button>
            <button autoFocus onClick={() => { onCerrarMenu(); onEditar() }} aria-label={`Editar ${nombre}`} className="boton boton-secundario">Editar</button>
            <button onClick={() => { onCerrarMenu(); onEliminar() }} aria-label={`Eliminar ${nombre}`} className="boton boton-peligro">Eliminar</button>
          </div>
        )}
      </div>

      <div className="flex items-center mt-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-6 truncate">{nombre}</p>
          <p className="text-sm leading-6 text-tenue truncate">{prenda.categorias?.nombre || 'Sin categoría'}</p>
          {prenda.salida && (
            <p className="text-xs leading-5 font-medium text-acento truncate">{prenda.salida === 'donar' ? 'Para donar' : 'Para vender'}</p>
          )}
          {ultimaVez(prenda) && (
            <p className="text-xs leading-5 text-tenue truncate">Usada el {etiquetaFechaCorta(ultimaVez(prenda))}</p>
          )}
        </div>
        <button onClick={() => (menuAbierto ? onCerrarMenu() : onAbrirMenu())} aria-label={`Opciones de ${nombre}`} aria-expanded={menuAbierto} className="boton-icono -mr-2 text-tenue">
          <Icono nombre="puntos" />
        </button>
      </div>
    </article>
  )
}



// La pestaña (Mi ropa / Quiero) se recuerda aunque la galería se vuelva a montar al guardar algo.
let vistaRecordada = 'ropa'

export default function GaleriaArmario({ limpiarSeleccion, onCrearConjunto, onEditarPrenda, onAbrirFicha, onAnadirPrenda, onAnadirDeseo, onVerOutfitsDeseo, onQueMePongo, onAbrirFiltros, onQuitarFiltro, mostrarToast, filtroCategoria, setDialogoGlobal, onCambio }) {
  const { prendas, cargando } = usePrendas()
  const [menuAbierto, setMenuAbierto] = useState(null)
  const [seleccionadas, setSeleccionadas] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState(sinFiltros)
  const [vista, setVista] = useState(vistaRecordada)
  const [limiteVisibles, setLimiteVisibles] = useState(24)
  const observadorReferencia = useRef(null)

  // Si algo desaparece (borrado aquí o desde otra vista), su selección y su menú se limpian.
  useEffect(() => {
    const ids = new Set(prendas.map(p => p.id))
    setSeleccionadas(sel => {
      const limpias = sel.filter(id => ids.has(id))
      return limpias.length === sel.length ? sel : limpias
    })
    setMenuAbierto(actual => (actual && !ids.has(actual) ? null : actual))
  }, [prendas])

  useEffect(() => { setSeleccionadas([]) }, [limpiarSeleccion])

  useEffect(() => { setLimiteVisibles(24) }, [busqueda, filtroCategoria, filtros])

  const prendasFiltradas = filtrarPrendas(prendas, {
    busqueda,
    categoriaId: filtroCategoria?.id || null,
    filtros,
    hoy: isoLocal(new Date()),
  })
  const alternarFiltro = (campo, valor) =>
    setFiltros(f => ({ ...f, [campo]: f[campo] === valor ? '' : valor }))

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

  // La foto viaja de la tarjeta a la ficha. Solo esos dos elementos llevan el
  // nombre de la transición, y se retira en cuanto termina.
  function abrirFicha(prenda, elemento) {
    vibrar(20)
    const abrir = () => onAbrirFicha(prenda)
    if (!elemento) { abrir(); return }

    const nombreVista = nombreVistaPrenda(prenda.id)
    elemento.style.viewTransitionName = nombreVista
    const limpiar = () => { elemento.style.viewTransitionName = '' }
    // El nombre se quita de la tarjeta dentro del cambio: la foto antigua ya
    // está capturada y la nueva (la ficha) es la única que lo lleva.
    const transicion = conTransicionVista(() => {
      elemento.style.viewTransitionName = ''
      flushSync(abrir)
    })
    if (!transicion) { limpiar(); return }
    transicion.finished?.then?.(limpiar, limpiar)
    setTimeout(limpiar, 1000)
  }

  function limpiarFiltros() {
    setBusqueda('')
    setFiltros(sinFiltros)
    onQuitarFiltro?.()
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
    if (e) e.stopPropagation()
    const relaciones = await relacionesDeLaPrenda(prenda.id)
    const numOutfits = new Set(relaciones.map(r => r.conjunto_id)).size

    setDialogoGlobal({
      mensaje: numOutfits > 0
        ? `¿Eliminar esta prenda? También saldrá de ${numOutfits === 1 ? '1 outfit' : `${numOutfits} outfits`}.`
        : '¿Eliminar esta prenda?',
      esDestructivo: true,
      textoConfirmar: 'Eliminar',
      onConfirm: () => {
        // Se oculta al instante, pero la fila sigue en la base hasta que pase el plazo:
        // deshacer es simplemente no borrar (sin perder escala, «por dentro», usos ni maleta).
        ocultarPrenda(prenda.id)
        setSeleccionadas(actuales => actuales.filter(sel => sel !== prenda.id))
        vibrar([50, 50])

        let resuelto = false
        let temporizador = null
        const soltarAvisos = () => document.removeEventListener('visibilitychange', alOcultar)
        const conservar = () => {
          if (resuelto) return
          resuelto = true
          clearTimeout(temporizador)
          soltarAvisos()
          conservarPrenda(prenda.id)
        }
        const borrar = async () => {
          if (resuelto) return
          resuelto = true
          clearTimeout(temporizador)
          soltarAvisos()
          const { error } = await supabase.from('prendas').delete().eq('id', prenda.id)
          if (error) {
            // Vuelve tal cual estaba y se avisa: nunca se queda a medias.
            conservarPrenda(prenda.id)
            return mostrarToast('No se pudo eliminar la prenda', 'error')
          }
          confirmarBorradoPrenda(prenda.id)
          onCambio?.()
          // La foto solo se borra cuando la fila ya no está.
          await borrarArchivo(prenda.imagen_url)
        }
        // Si se sale de la app antes del plazo, se borra ya. Si no llega a enviarse, la prenda sigue ahí.
        const alOcultar = () => { if (document.visibilityState === 'hidden') borrar() }
        document.addEventListener('visibilitychange', alOcultar)
        temporizador = setTimeout(borrar, 7000)

        mostrarToast('Prenda eliminada', 'info', {
          texto: 'Deshacer',
          onClick: () => {
            if (resuelto) return
            conservar()
            mostrarToast('Prenda recuperada', 'exito')
          },
        })
      }
    })
  }

  async function marcarUso(prenda) {
    setMenuAbierto(null)
    const hoy = isoLocal(new Date())
    const usosAntes = prenda.usos || []
    if (usosAntes.some(u => u.fecha === hoy)) {
      return mostrarToast('Ya está anotado que te lo pusiste hoy', 'info')
    }
    // Se pinta al instante; sin conexión la cola lo enviará al volver la red.
    actualizarPrenda(prenda.id, { usos: [...usosAntes, { fecha: hoy }] })
    vibrar(20)

    const estado = await escribir({ tabla: 'usos', accion: 'insert', datos: { prenda_id: prenda.id, fecha: hoy } })
    if (estado === 'error') {
      actualizarPrenda(prenda.id, { usos: usosAntes })
      return mostrarToast('No se pudo anotar el uso', 'error')
    }

    mostrarToast(estado === 'encolada' ? 'Anotado: se enviará cuando vuelva la conexión' : 'Anotado: te lo has puesto hoy', 'exito')
  }

  const prendasVisibles = prendasFiltradas.slice(0, limiteVisibles)
  const deseos = prendas.filter(p => p.deseada && !p.archivada)

  function yaLoTengo(deseo) {
    vibrar(20)
    cambiarDeseo(deseo, { deseada: false }, `«${deseo.nombre}» ya está en tu armario`)
  }

  async function cambiarDeseo(deseo, campos, mensaje) {
    const antes = Object.fromEntries(Object.keys(campos).map(c => [c, deseo[c] ?? null]))
    actualizarPrenda(deseo.id, campos)
    const { error } = await supabase.from('prendas').update(campos).eq('id', deseo.id)
    if (error) {
      actualizarPrenda(deseo.id, antes)
      return mostrarToast('No se pudo guardar', 'error')
    }
    mostrarToast(mensaje, 'exito')
  }

  function quitarDeseo(deseo, e) {
    e.stopPropagation()
    setDialogoGlobal({
      mensaje: `¿Quitar «${deseo.nombre}» de tu lista de deseos?`,
      esDestructivo: true,
      textoConfirmar: 'Quitar',
      onConfirm: async () => {
        quitarPrenda(deseo.id)
        vibrar([50, 50])
        const { error } = await supabase.from('prendas').delete().eq('id', deseo.id)
        if (error) {
          reponerPrenda(deseo)
          return mostrarToast('No se pudo quitar', 'error')
        }
        borrarArchivo(deseo.imagen_url)
      },
    })
  }

  return (
    <div className="flex flex-col flex-1 shrink-0">
      <div role="tablist" aria-label="Armario" className="mb-4 flex gap-1 rounded-xl bg-lamina p-1 self-start">
        {[['ropa', 'Mi ropa'], ['quiero', `Quiero${deseos.length ? ` (${deseos.length})` : ''}`]].map(([id, texto]) => (
          <button key={id} role="tab" aria-selected={vista === id} onClick={() => { vibrar(10); vistaRecordada = id; setVista(id) }} className={`min-h-11 px-5 rounded-lg text-sm font-semibold ${vista === id ? 'bg-superficie text-tinta shadow-sm' : 'text-tenue'}`}>
            {texto}
          </button>
        ))}
      </div>

      {vista === 'quiero' ? (
        <ListaDeseos
          deseos={deseos}
          armario={prendas}
          onAnadir={onAnadirDeseo}
          onVerOutfits={onVerOutfitsDeseo}
          onYaLoTengo={yaLoTengo}
          onEliminar={quitarDeseo}
        />
      ) : (
        <>
      {prendas.length >= 2 && <BotonQueMePongo onClick={onQueMePongo} className="mb-4 md:self-start" />}
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

      <div role="group" aria-label="Filtros" className="-mx-4 md:mx-0 px-4 md:px-0 mb-4 flex gap-2 overflow-x-auto sin-barra">
        {FAMILIAS_COLOR.map(f => (
          <button key={f} onClick={() => alternarFiltro('familia', f)} aria-pressed={filtros.familia === f} className={`${chipFiltro(filtros.familia === f)} inline-flex items-center gap-2`}>
            <span className="w-3.5 h-3.5 rounded-full border border-linea" style={{ background: PUNTO_FAMILIA[f] }} aria-hidden="true" />
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        {TEMPORADAS.map(t => (
          <button key={t} onClick={() => alternarFiltro('temporada', t)} aria-pressed={filtros.temporada === t} className={chipFiltro(filtros.temporada === t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        {GRUPOS_FORMALIDAD.map(g => (
          <button key={g.id} onClick={() => alternarFiltro('formalidad', g.id)} aria-pressed={filtros.formalidad === g.id} className={chipFiltro(filtros.formalidad === g.id)}>
            {g.etiqueta}
          </button>
        ))}
        <button onClick={() => setFiltros(f => ({ ...f, olvidadas: !f.olvidadas }))} aria-pressed={filtros.olvidadas} className={chipFiltro(filtros.olvidadas)}>
          Sin usar en 90 días
        </button>
        {hayFiltros(filtros) && (
          <button onClick={() => setFiltros(sinFiltros)} className="shrink-0 min-h-11 px-3 text-sm text-tenue whitespace-nowrap">Quitar filtros</button>
        )}
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
        prendas.length === 0 ? (
          <EstadoVacio
            dibujo="percha"
            titulo="Aún no hay prendas"
            texto="Empieza por la que más te pones. La foto se recorta sola."
            accionTexto="Añadir una prenda"
            onAccion={onAnadirPrenda}
          />
        ) : (
          <EstadoVacio
            dibujo="percha"
            titulo="No hay prendas que coincidan"
            texto="Prueba con otra búsqueda o quita los filtros."
            accionTexto="Quitar filtros"
            onAccion={limpiarFiltros}
          />
        )
      ) : (
        <>
          <div className="rejilla mb-4">
            {prendasVisibles.map((prenda) => (
              <TarjetaPrenda
                key={prenda.id}
                prenda={prenda}
                seleccionada={seleccionadas.includes(prenda.id)}
                enSeleccion={seleccionadas.length > 0}
                menuAbierto={menuAbierto === prenda.id}
                onAbrirMenu={() => setMenuAbierto(prenda.id)}
                onCerrarMenu={() => setMenuAbierto(null)}
                onSeleccionar={() => alternarSeleccion(prenda.id)}
                onAbrirFicha={abrirFicha}
                onMarcarUso={() => marcarUso(prenda)}
                onEditar={() => onEditarPrenda(prenda)}
                onEliminar={() => solicitarEliminacionPrenda(prenda)}
              />
            ))}
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
        </>
      )}
    </div>
  )
}
