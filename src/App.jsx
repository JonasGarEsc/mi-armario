import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useDeslizarPaneles } from './lib/useDeslizarPaneles'
import { fijarSeccionVisual } from './lib/seccionVisual'
import { crearGestorAtras } from './lib/atras'
import { refrescarPrendas, reiniciarPrendas } from './lib/almacen'
import GaleriaArmario from './components/GaleriaArmario'
import VistaConjuntos from './components/VistaConjuntos'
import VistaSemanas from './components/VistaSemanas'
import AvisoUso from './components/AvisoUso'
import { colaOffline } from './lib/offline'
import Icono from './components/Icono'
import Acceso from './components/Acceso'
import NuevaContrasena from './components/NuevaContrasena'
import { supabase } from './supabase'
import { esDuplicado } from './lib/outfits'
import { fijarEspacio } from './lib/cache'
import { vibrar } from './lib/vibrar'
import { nombreLibre } from './lib/nombres'
import { etiquetaDia } from './lib/fechas'
import { exportarDatos, restaurarCopia } from './lib/copiaSeguridad'
import { conTiempoLimite } from './lib/conTiempo'
import { desactivar } from './lib/push'
import { SECCIONES } from './lib/secciones'
import { TituloSeccion, BarraSecciones, NavegacionEscritorio } from './components/Navegacion'
import { PantallaCarga, IndicadorCarga, IndicadorConexion } from './components/Indicadores'
import Hoja from './components/Hoja'
import ContenidoHoja from './components/ContenidoHoja'
import DialogoGlobal from './components/DialogoGlobal'

const LIMITE_DESACTIVAR_MS = 4000

// Pinta el tema en el documento: lo usan el armario (elige el usuario) y el acceso (elige el sistema).
function pintarTema(oscuro) {
  const root = document.documentElement
  if (oscuro) root.classList.add('modo-oscuro')
  else root.classList.remove('modo-oscuro')
  root.style.colorScheme = oscuro ? 'dark' : 'light'
  // Quitar 'media' evita que el navegador imponga el suyo y deje las dos etiquetas descoordinadas.
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
    meta.removeAttribute('media')
    meta.setAttribute('content', oscuro ? '#0f1012' : '#f6f6f7')
  })
}

// Puerta de entrada: sin sesión no se monta el armario, así ninguna consulta sale
// antes de que Supabase sepa quién eres (y RLS no devuelva vacío).
export default function App() {
  const [sesion, setSesion] = useState(undefined)
  const [recuperando, setRecuperando] = useState(false)

  useEffect(() => {
    let activo = true
    let usuario = undefined

    // La caché va por cuenta: en un móvil compartido no se cuela la ropa ajena.
    const cambiarEspacio = (nueva) => {
      const id = nueva?.user?.id || null
      if (id === usuario) return
      usuario = id
      fijarEspacio(id)
      reiniciarPrendas()
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, nueva) => {
      if (!activo) return
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true)
      cambiarEspacio(nueva)
      setSesion(nueva ?? null)
      // Al refrescar la sesión, lo que quedó pendiente por un 401/JWT caducado se reintenta.
      if (evento === 'TOKEN_REFRESHED') void colaOffline.vaciar()
    })

    supabase.auth.getSession().then(({ data }) => {
      if (!activo) return
      cambiarEspacio(data.session)
      setSesion(actual => (actual === undefined ? (data.session ?? null) : actual))
    })

    return () => { activo = false; subscription.unsubscribe() }
  }, [])

  const enAcceso = sesion === null || Boolean(sesion && recuperando)

  // Entrar, registrarse o recuperar contraseña siguen el tema del sistema, no el guardado:
  // así respetan el cambio en vivo y el ajuste del móvil tras cerrar sesión.
  useEffect(() => {
    if (!enAcceso) return undefined
    const sistema = window.matchMedia('(prefers-color-scheme: dark)')
    pintarTema(sistema.matches)
    const alCambiar = (e) => pintarTema(e.matches)
    sistema.addEventListener('change', alCambiar)
    return () => sistema.removeEventListener('change', alCambiar)
  }, [enAcceso])

  if (sesion === undefined) return <PantallaCarga />
  if (sesion && recuperando) return <NuevaContrasena onListo={() => setRecuperando(false)} />
  if (!sesion) return <Acceso />
  return <Armario key={sesion.user?.id || 'sesion'} sesion={sesion} />
}

// El armario se monta ya con sesión: cada consulta va filtrada por RLS al usuario.

function Armario({ sesion }) {
  const [pestañaActiva, setPestañaActiva] = useState('ropa')
  const [actualizaciones, setActualizaciones] = useState(0)

  const [modalActivo, setModalActivo] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)

  const [prendaAEditar, setPrendaAEditar] = useState(null)
  const [prendaFicha, setPrendaFicha] = useState(null)
  const [outfitsGuardados, setOutfitsGuardados] = useState(0)
  const [prendasParaConjunto, setPrendasParaConjunto] = useState([])
  const [maletasDisponibles, setMaletasDisponibles] = useState([])
  const [objetivoSemana, setObjetivoSemana] = useState(null)
  const [maletaAsistente, setMaletaAsistente] = useState(null)
  const [usoPendiente, setUsoPendiente] = useState(null)
  const [prendaFijada, setPrendaFijada] = useState(null)
  const [modoDeseo, setModoDeseo] = useState(false)
  const [deseoElegido, setDeseoElegido] = useState(null)
  const [refrescoMaleta, setRefrescoMaleta] = useState(0)

  const [toasts, setToasts] = useState([])

  const [datosMenu, setDatosMenu] = useState(null)
  const [filtroActual, setFiltroActual] = useState(null)
  const hojaRef = useRef(null)
  const origenFoco = useRef(null)
  const atrasRef = useRef(null)
  if (!atrasRef.current) atrasRef.current = crearGestorAtras(window.history)

  const [dialogoGlobal, setDialogoGlobal] = useState(null)

  const [temaOscuro, setTemaOscuro] = useState(() => {
    if (typeof window !== 'undefined') {
      const temaGuardado = localStorage.getItem('tema_armario')
      if (temaGuardado) return temaGuardado === 'dark'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  useEffect(() => {
    pintarTema(temaOscuro)
    localStorage.setItem('tema_armario', temaOscuro ? 'dark' : 'light')
  }, [temaOscuro])

  useEffect(() => {
    if (modalActivo !== 'filtros') return
    async function cargarDatosMenu() {
      const [{ data: tipos }, { data: categorias }] = await Promise.all([
        supabase.from('tipos').select('*').order('nombre'),
        supabase.from('categorias').select('*').order('nombre'),
      ])
      if (tipos && categorias) {
         const menuEstructurado = tipos.map(t => ({
           ...t,
           categorias: categorias.filter(c => c.tipo_id === t.id)
         }))
         setDatosMenu(menuEstructurado)
         // Un filtro que apunte a una categoría borrada (o renombrada) se limpia solo.
         setFiltroActual(actual => (actual ? categorias.find(c => c.id === actual.id) || null : actual))
      }
    }
    cargarDatosMenu()
  }, [modalActivo, actualizaciones])

  const mostrarToast = (mensaje, tipo = 'info', accion = null) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, mensaje, tipo, accion }])
    vibrar(20)
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, accion ? 7000 : 3500)
  }

  const cerrarToast = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  // Copia de seguridad manual: todo el armario en un JSON que se descarga.
  const descargarCopia = () => exportarDatos(supabase, mostrarToast)

  const alElegirCopia = (e) => {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    void restaurarCopia(supabase, archivo, { mostrarToast, solicitarConfirmacionGlobal, recargarVistas })
  }

  // Refresca lo compartido (prendas) y avisa a las vistas persistentes (maletas, semanas).
  const recargarVistas = () => {
    setActualizaciones(prev => prev + 1)
    void refrescarPrendas()
  }

  function prepararMaleta(maleta) {
    setMaletaAsistente(maleta)
    setPestañaActiva('conjuntos')
    abrirModal('asistente_maleta')
    vibrar(30)
  }

  const abrirModal = (tipo, { inmediato = false } = {}) => {
    if (!modalActivo) origenFoco.current = document.activeElement
    setModalActivo(tipo)
    const enfocar = () => {
      hojaRef.current?.focus({ preventScroll: true })
      // Al cambiar de una hoja a otra (ficha → editar), el contenido empieza arriba.
      const contenido = hojaRef.current?.querySelector('[data-hoja-contenido]')
      if (contenido) contenido.scrollTop = 0
    }
    // Con transición de la foto, la hoja nace ya en su sitio: la captura nueva
    // coincide con la posición final y no se ve entrar desde abajo.
    if (inmediato) {
      setModalVisible(true)
      requestAnimationFrame(enfocar)
      return
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setModalVisible(true)
        enfocar()
      })
    })
  }

  const cerrarModal = () => {
    setModalVisible(false)
    setTimeout(() => {
      setModalActivo(null)
      setPrendaAEditar(null)
      setPrendaFicha(null)
      setPrendasParaConjunto([])
      setObjetivoSemana(null)
      requestAnimationFrame(() => origenFoco.current?.focus?.({ preventScroll: true }))
    }, 300)
  }

  const abrirHoy = () => { abrirModal('hoy'); vibrar(20) }

  // La notificación abre /?vista=hoy: se abre sola y el parámetro se limpia.
  const abrirModalRef = useRef(abrirModal)
  abrirModalRef.current = abrirModal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('vista') !== 'hoy') return
    params.delete('vista')
    const resto = params.toString()
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${resto ? `?${resto}` : ''}${window.location.hash}`,
    )
    abrirModalRef.current('hoy', { inmediato: true })
  }, [])

  // Atrás cierra la capa de arriba (diálogo u hoja) y consume su entrada.
  useEffect(() => {
    if (!modalActivo) return undefined
    return atrasRef.current.abrir('hoja', cerrarModal)
  }, [modalActivo])

  useEffect(() => {
    if (!dialogoGlobal) return undefined
    return atrasRef.current.abrir('dialogo', () => setDialogoGlobal(null))
  }, [dialogoGlobal])

  useEffect(() => {
    const alPulsar = (e) => {
      if (e.key !== 'Escape') return
      if (dialogoGlobal) setDialogoGlobal(null)
      else if (modalActivo) cerrarModal()
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  })

  const solicitarConfirmacionGlobal = (config) => {
    vibrar(30)
    setDialogoGlobal(config)
  }

  // Primero se quita el aviso del navegador y la fila, y después se cierra la
  // sesión. Si el aviso falla o tarda, el cierre sigue igual.
  async function cerrarSesion() {
    cerrarModal()
    await conTiempoLimite(desactivar(supabase), LIMITE_DESACTIVAR_MS)
    await supabase.auth.signOut()
  }

  const irA = (seccion) => { fijarSeccionVisual(seccion); setPestañaActiva(seccion); vibrar(30) }
  // La barra y el título siguen a la sección activa, venga el cambio de donde venga.
  useLayoutEffect(() => { fijarSeccionVisual(pestañaActiva) }, [pestañaActiva])

  // Los paneles siguen al dedo; arrastrar una prenda dentro de un outfit
  // (data-sin-swipe) no cambia de sección.
  const indiceSeccion = { ropa: 0, conjuntos: 1, semana: 2 }[pestañaActiva] ?? 0
  const pistaRef = useDeslizarPaneles({
    indice: indiceSeccion,
    total: SECCIONES.length,
    // Al soltar: solo la barra y el título (baratos). Al acabar la animación: la app.
    onPrevisualizar: (i) => { fijarSeccionVisual(SECCIONES[i].id); vibrar(30) },
    onCambiar: (i) => setPestañaActiva(SECCIONES[i].id),
  })

  function iniciarEdicion(prenda) {
    setPrendaAEditar(prenda)
    abrirModal('editar')
    vibrar(30)
  }

  function abrirFicha(prenda) {
    setPrendaFicha(prenda)
    abrirModal('ficha', { inmediato: true })
    vibrar(20)
  }

  async function iniciarCreacionConjunto(idsSeleccionados) {
    const { data } = await supabase.from('maletas').select('*').order('nombre')
    if (!data || data.length === 0) {
      mostrarToast("Debes crear una maleta primero", "error")
      return
    }
    setMaletasDisponibles(data)
    setPrendasParaConjunto(idsSeleccionados)
    abrirModal('crear_conjunto')
    vibrar(30)
  }

  async function guardarConjunto(e) {
    e.preventDefault()
    const nombre = e.target.nombreConjunto.value.trim()
    const maleta_id = e.target.maletaId.value

    const { data: conjuntosExistentes, error: errConsulta } = await supabase.from('conjuntos').select('id, nombre, conjunto_prenda(prenda_id)').eq('maleta_id', maleta_id)
    if (errConsulta) return mostrarToast('No se pudo comprobar duplicados', 'error')
    if (esDuplicado(conjuntosExistentes, prendasParaConjunto)) return mostrarToast('Esa combinación ya existe', 'error')

    const nombreFinal = nombreLibre(nombre, (conjuntosExistentes || []).map(c => c.nombre))

    // Una sola llamada: si falla, no queda un outfit vacío.
    const { error } = await supabase.from('conjuntos').insert([{
      nombre: nombreFinal,
      maleta_id,
      conjunto_prenda: prendasParaConjunto.map(prenda_id => ({ prenda_id }))
    }])
    if (error) return mostrarToast("Error al guardar", "error")

    vibrar([50, 50])
    mostrarToast("Outfit guardado", "exito")
    setOutfitsGuardados(n => n + 1)
    cerrarModal()
    recargarVistas()
    setPestañaActiva('conjuntos')
  }

  async function crearOutfitSemana(nombre, ids) {
    if (!objetivoSemana?.semana || !objetivoSemana?.fecha || ids.length === 0) return
    const { semana, fecha } = objetivoSemana

    const { data: existentes, error: errConsulta } = await supabase
      .from('conjuntos')
      .select('id, nombre, conjunto_prenda(prenda_id)')
      .eq('semana_id', semana.id)
      .eq('fecha', fecha)
    if (errConsulta) {
      mostrarToast('No se pudo comprobar duplicados', 'error')
      return
    }
    if (esDuplicado(existentes, ids)) {
      mostrarToast('Esa combinación ya existe ese día', 'error')
      return
    }

    const nombreFinal = nombreLibre(nombre, (existentes || []).map(c => c.nombre))
    const { error } = await supabase.from('conjuntos').insert([{
      nombre: nombreFinal,
      semana_id: semana.id,
      fecha,
      conjunto_prenda: ids.map(prenda_id => ({ prenda_id })),
    }])
    if (error) {
      mostrarToast(`Error al guardar: ${error.message}`, 'error')
      return
    }

    vibrar([50, 50])
    mostrarToast(`Outfit guardado el ${etiquetaDia(fecha)}`, 'exito')
    cerrarModal()
    recargarVistas()
  }

  const aplicarFiltro = (categoria) => {
    setFiltroActual(categoria)
    setPestañaActiva('ropa')
    cerrarModal()
    vibrar(15)
  }

  const panel = 'relative w-1/3 min-w-0 h-full flex flex-col overflow-y-auto overscroll-y-contain sin-barra px-4 md:px-8 pt-2 md:pt-8 pb-4 md:pb-8 touch-pan-y'

  return (
    <div className="h-dvh bg-papel text-tinta w-full overflow-hidden font-sans">

      <div role="status" className="fixed top-0 inset-x-0 z-300 pt-safe flex flex-col gap-2 items-center pointer-events-none px-4">
        {toasts.map(toast => (
          <div key={toast.id} className="aparece mt-3 flex items-center gap-2 rounded-xl bg-tinta text-papel pl-4 pr-2 min-h-12 max-w-full w-max pointer-events-auto shadow-(--sombra)">
            <p className="py-2 pr-2">{toast.mensaje}</p>
            {toast.accion && (
              <button
                onClick={() => { cerrarToast(toast.id); toast.accion.onClick() }}
                className="min-h-11 px-3 rounded-xl font-bold underline underline-offset-4"
              >
                {toast.accion.texto}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="h-full flex flex-col" inert={!!(modalActivo || dialogoGlobal)}>
        <header className="shrink-0 pt-safe md:border-b md:border-linea md:bg-superficie">
          <div className="max-w-6xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
            <h1 className="titular min-w-0 text-[1.85rem] md:text-2xl font-bold tracking-tight">
              <span className="md:hidden"><TituloSeccion respaldo={pestañaActiva} /></span>
              <span className="hidden md:inline">Perletta</span>
            </h1>

            <NavegacionEscritorio activa={pestañaActiva} onIr={irA} onHoy={abrirHoy} />

            <button onClick={() => { abrirModal('ajustes'); vibrar(20) }} aria-label="Ajustes" className="boton-icono -mr-2">
              <Icono nombre="ajustes" />
            </button>
          </div>
        </header>

        <AvisoUso
          version={actualizaciones}
          mostrarToast={mostrarToast}
          onCambio={(outfit) => { setUsoPendiente(outfit); abrirModal('confirmar_uso'); vibrar(20) }}
        />

        <main className="flex-1 min-h-0 w-full max-w-6xl mx-auto overflow-hidden">
          <div ref={pistaRef} className="flex w-[300%] h-full">
            <section aria-label="Armario" inert={pestañaActiva !== 'ropa'} className={panel}>
              <h2 className="titular max-md:sr-only shrink-0 text-3xl font-bold tracking-tight min-h-12 mb-5">Armario</h2>
              <GaleriaArmario limpiarSeleccion={outfitsGuardados} onCrearConjunto={iniciarCreacionConjunto} onEditarPrenda={iniciarEdicion} onAbrirFicha={abrirFicha} onQueMePongo={() => { setPrendaFijada(null); abrirModal('que_me_pongo'); vibrar(30) }} onAnadirPrenda={() => { setModoDeseo(false); abrirModal('formulario'); vibrar(30) }} onAnadirDeseo={() => { setModoDeseo(true); abrirModal('formulario'); vibrar(30) }} onVerOutfitsDeseo={(d) => { setDeseoElegido(d); abrirModal('deseo_outfits'); vibrar(20) }} onAbrirFiltros={() => abrirModal('filtros')} onQuitarFiltro={() => setFiltroActual(null)} mostrarToast={mostrarToast} filtroCategoria={filtroActual} setDialogoGlobal={solicitarConfirmacionGlobal} onCambio={recargarVistas} />
            </section>
            <section aria-label="Maletas" inert={pestañaActiva !== 'conjuntos'} className={panel}>
              <VistaConjuntos onCrearMaleta={() => { abrirModal('crear_maleta'); vibrar(30) }} onPrepararMaleta={prepararMaleta} refresco={refrescoMaleta} recarga={actualizaciones} mostrarToast={mostrarToast} setDialogoGlobal={solicitarConfirmacionGlobal} />
            </section>
            <section aria-label="Semana" inert={pestañaActiva !== 'semana'} className={panel}>
              <VistaSemanas
                activa={pestañaActiva === 'semana'}
                recarga={actualizaciones}
                onCrearSemana={() => { abrirModal('crear_semana'); vibrar(30) }}
                onQueMePongo={() => { setPrendaFijada(null); abrirModal('que_me_pongo'); vibrar(30) }}
                onAnadirOutfit={(semana, fecha) => { setObjetivoSemana({ semana, fecha }); abrirModal('elegir_prendas'); vibrar(30) }}
                mostrarToast={mostrarToast}
                setDialogoGlobal={solicitarConfirmacionGlobal}
              />
            </section>
          </div>
        </main>

        <BarraSecciones respaldo={pestañaActiva} onIr={irA} onHoy={abrirHoy} />
        <IndicadorConexion mostrarToast={mostrarToast} />
        <IndicadorCarga oculto={modalActivo === 'carga_masiva'} onAbrir={() => { abrirModal('carga_masiva'); vibrar(20) }} />
      </div>

      {modalActivo && (
        <Hoja hojaRef={hojaRef} visible={modalVisible} onCerrar={cerrarModal} bloqueada={!!dialogoGlobal}>
          <ContenidoHoja
            modalActivo={modalActivo}
            prendaFicha={prendaFicha}
            prendaAEditar={prendaAEditar}
            modoDeseo={modoDeseo}
            usoPendiente={usoPendiente}
            maletaAsistente={maletaAsistente}
            objetivoSemana={objetivoSemana}
            maletasDisponibles={maletasDisponibles}
            deseoElegido={deseoElegido}
            prendaFijada={prendaFijada}
            filtroActual={filtroActual}
            datosMenu={datosMenu}
            temaOscuro={temaOscuro}
            sesion={sesion}
            mostrarToast={mostrarToast}
            cerrarModal={cerrarModal}
            abrirModal={abrirModal}
            recargarVistas={recargarVistas}
            prepararMaleta={prepararMaleta}
            guardarConjunto={guardarConjunto}
            crearOutfitSemana={crearOutfitSemana}
            aplicarFiltro={aplicarFiltro}
            exportarDatos={descargarCopia}
            alElegirCopia={alElegirCopia}
            cerrarSesion={cerrarSesion}
            solicitarConfirmacionGlobal={solicitarConfirmacionGlobal}
            setTemaOscuro={setTemaOscuro}
            setPrendaAEditar={setPrendaAEditar}
            setPrendaFijada={setPrendaFijada}
            setRefrescoMaleta={setRefrescoMaleta}
            setPestañaActiva={setPestañaActiva}
          />
        </Hoja>
      )}

      {dialogoGlobal && <DialogoGlobal dialogo={dialogoGlobal} onCerrar={() => setDialogoGlobal(null)} />}

    </div>
  )
}
