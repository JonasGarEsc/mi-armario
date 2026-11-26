import { useState, useEffect, useLayoutEffect, useRef, lazy, Suspense } from 'react'
import { useArrastrarHoja } from './lib/useArrastrarHoja'
import { useDeslizarPaneles } from './lib/useDeslizarPaneles'
import { fijarSeccionVisual, useSeccionVisual } from './lib/seccionVisual'
import { crearGestorAtras } from './lib/atras'
import { refrescarPrendas, reiniciarPrendas } from './lib/almacen'
import GaleriaArmario from './components/GaleriaArmario'
import VistaConjuntos from './components/VistaConjuntos'
import VistaSemanas from './components/VistaSemanas'
import AvisoUso from './components/AvisoUso'
import { resumenCarga } from './lib/cargaMasiva'
import { colaOffline, useConexion } from './lib/offline'
import { useCargaMasiva } from './lib/cargaMasivaApp'
import { ciudadGuardada, guardarCiudad } from './lib/clima'
import Icono from './components/Icono'
import Acceso from './components/Acceso'
import NuevaContrasena from './components/NuevaContrasena'
import { supabase } from './supabase'
import { esDuplicado } from './lib/outfits'
import { fijarEspacio } from './lib/cache'
import { vibrar } from './lib/vibrar'
import { nombreLibre } from './lib/nombres'
import { etiquetaDia } from './lib/fechas'
import { contarCopia, importarCopia, leerTabla } from './lib/backup'

// Todo lo que solo se ve dentro de una hoja pesa y se descarga al abrirla:
// el motor de recorte, las estadísticas, la carga masiva, etc.
const FormularioPrenda = lazy(() => import('./components/FormularioPrenda'))
const FormularioEdicion = lazy(() => import('./components/FormularioEdicion'))
const FormularioMaleta = lazy(() => import('./components/FormularioMaleta'))
const FormularioSemana = lazy(() => import('./components/FormularioSemana'))
const SelectorPrendas = lazy(() => import('./components/SelectorPrendas'))
const EtiquetarArmario = lazy(() => import('./components/EtiquetarArmario'))
const QueMePongo = lazy(() => import('./components/QueMePongo'))
const AsistenteMaleta = lazy(() => import('./components/AsistenteMaleta'))
const Estadisticas = lazy(() => import('./components/Estadisticas'))
const CargaMasiva = lazy(() => import('./components/CargaMasiva'))
const OutfitsConDeseo = lazy(() => import('./components/OutfitsConDeseo'))
const ConfirmarUso = lazy(() => import('./components/ConfirmarUso'))
const Gestores = lazy(() => import('./components/Gestores'))
const ResumenUsos = lazy(() => import('./components/ResumenUsos'))

const SECCIONES = [
  { id: 'ropa', nombre: 'Armario', icono: 'percha' },
  { id: 'conjuntos', nombre: 'Maletas', icono: 'maleta' },
  { id: 'semana', nombre: 'Semana', icono: 'calendario' }
]

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

// La barra de pestañas y el título leen la sección visible por su cuenta:
// al deslizar se actualizan solos, sin re-renderizar el armario entero.
function TituloSeccion({ respaldo }) {
  const activa = useSeccionVisual(respaldo)
  return SECCIONES.find(s => s.id === activa)?.nombre ?? null
}

function BarraSecciones({ respaldo, onIr }) {
  const activa = useSeccionVisual(respaldo)
  return (
    <nav aria-label="Secciones" className="md:hidden shrink-0 bg-superficie border-t border-linea pb-safe">
      <div className="grid grid-cols-3">
        {SECCIONES.map(s => (
          <button key={s.id} onClick={() => onIr(s.id)} aria-current={activa === s.id ? 'page' : undefined} className={`h-16 flex flex-col items-center justify-center gap-0.5 text-sm ${activa === s.id ? 'text-acento font-semibold' : 'text-tenue'}`}>
            <Icono nombre={s.icono} />
            {s.nombre}
          </button>
        ))}
      </div>
    </nav>
  )
}

// Pastilla flotante mientras hay fotos preparándose o por revisar: abre la hoja de subida masiva.
function IndicadorCarga({ oculto, onAbrir }) {
  const items = useCargaMasiva()
  useEffect(() => {
    // Con fotos sin guardar, el navegador avisa antes de cerrar la pestaña.
    if (items.length === 0) return undefined
    const avisar = (e) => { e.preventDefault() }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [items.length])
  if (items.length === 0 || oculto) return null
  const r = resumenCarga(items)
  return (
    <button onClick={onAbrir} className="aparece fixed z-40 left-1/2 -translate-x-1/2 bottom-24 md:bottom-6 min-h-11 px-4 rounded-full bg-tinta text-papel text-sm font-semibold shadow-(--sombra)">
      {r.activas > 0 ? `Preparando fotos · ${r.terminadas}/${r.total}` : `${r.listas} ${r.listas === 1 ? 'prenda' : 'prendas'} por revisar`}
    </button>
  )
}

// «Sin conexión» y cuántos cambios esperan a enviarse. Al volver la red se envían solos.
function IndicadorConexion({ mostrarToast }) {
  const { enLinea, pendientes } = useConexion()
  const [enviando, setEnviando] = useState(false)
  const aviso = useRef(mostrarToast)
  aviso.current = mostrarToast

  useEffect(() => colaOffline.suscribirDescartes((n) => {
    aviso.current(`${n} ${n === 1 ? 'cambio' : 'cambios'} no se ${n === 1 ? 'pudo' : 'pudieron'} guardar y se ${n === 1 ? 'ha' : 'han'} descartado`, 'error')
  }), [])

  useEffect(() => {
    // La cola es de esta cuenta: se lee al entrar y se vacía al volver la red.
    let vivo = true
    const sincronizar = async () => {
      if (colaOffline.cuantas() === 0) return
      setEnviando(true)
      const r = await colaOffline.vaciar()
      if (!vivo) return
      setEnviando(false)
      if (r.enviadas > 0) aviso.current(`${r.enviadas} ${r.enviadas === 1 ? 'cambio sincronizado' : 'cambios sincronizados'}`, 'exito')
    }
    colaOffline.recargar()
    sincronizar()
    window.addEventListener('online', sincronizar)
    return () => { vivo = false; window.removeEventListener('online', sincronizar) }
  }, [])

  if (enLinea && pendientes === 0) return null
  return (
    <p role="status" className="aparece fixed z-50 left-1/2 -translate-x-1/2 top-[max(0.5rem,env(safe-area-inset-top))] mt-1 px-3 min-h-8 flex items-center rounded-full bg-tinta text-papel text-xs font-semibold shadow-(--sombra) pointer-events-none">
      {!enLinea ? 'Sin conexión' : enviando ? 'Enviando cambios…' : 'Cambios por enviar'}
      {pendientes > 0 && ` · ${pendientes} por enviar`}
    </p>
  )
}

function PantallaCarga() {
  return (
    <div className="h-dvh grid place-items-center bg-papel">
      <div role="status" aria-label="Cargando" className="esqueleto h-10 w-40" />
    </div>
  )
}

// El armario se monta ya con sesión: cada consulta va filtrada por RLS al usuario.

function Armario({ sesion }) {
  const [pestañaActiva, setPestañaActiva] = useState('ropa')
  const [actualizaciones, setActualizaciones] = useState(0)
  
  const [modalActivo, setModalActivo] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  
  const [prendaAEditar, setPrendaAEditar] = useState(null)
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
  async function exportarDatos() {
    const tablas = ['categorias', 'tipos', 'prendas', 'maletas', 'semanas', 'conjuntos', 'conjunto_prenda', 'usos', 'maleta_extras']
    const copia = { exportado_en: new Date().toISOString(), version: 4 }
    for (const tabla of tablas) {
      const { data, error } = await leerTabla(supabase, tabla)
      if (error) {
        // Base de datos antigua sin la lista de la maleta: se copia el resto.
        if (tabla === 'maleta_extras' && ['42P01', 'PGRST205'].includes(error.code)) continue
        return mostrarToast(`No se pudo exportar ${tabla}`, 'error')
      }
      copia[tabla] = data
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(copia, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `perletta-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    mostrarToast('Copia descargada', 'exito')
  }

  async function alElegirCopia(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return

    let crudo
    try {
      crudo = JSON.parse(await archivo.text())
    } catch {
      return mostrarToast('Ese archivo no es una copia válida', 'error')
    }

    let cuenta
    try {
      cuenta = contarCopia(crudo)
    } catch (error) {
      return mostrarToast(error.message, 'error')
    }

    solicitarConfirmacionGlobal({
      mensaje: `¿Restaurar la copia? Se añadirán ${cuenta.prendas} prendas y ${cuenta.conjuntos} outfits a lo que ya tienes.`,
      esDestructivo: false,
      textoConfirmar: 'Restaurar',
      onConfirm: async () => {
        try {
          const resumen = await importarCopia(supabase, crudo)
          vibrar([50, 50])
          mostrarToast(`Copia restaurada: ${resumen.prendas} prendas y ${resumen.conjuntos} outfits`, 'exito')
          recargarVistas()
        } catch (error) {
          mostrarToast(error.message || 'No se pudo restaurar la copia', 'error')
        }
      },
    })
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
  
  const abrirModal = (tipo) => {
    if (!modalActivo) origenFoco.current = document.activeElement
    setModalActivo(tipo)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setModalVisible(true)
        hojaRef.current?.focus({ preventScroll: true })
      })
    })
  }

  const cerrarModal = () => {
    setModalVisible(false)
    setTimeout(() => {
      setModalActivo(null)
      setPrendaAEditar(null)
      setPrendasParaConjunto([])
      setObjetivoSemana(null)
      requestAnimationFrame(() => origenFoco.current?.focus?.({ preventScroll: true }))
    }, 300)
  }

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
  const asaRef = useArrastrarHoja(hojaRef, () => cerrarModal(), !!modalActivo)

  function iniciarEdicion(prenda) {
    setPrendaAEditar(prenda)
    abrirModal('editar')
    vibrar(30)
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

  const chip = (activo) => `min-h-11 px-4 rounded-full ${activo ? 'bg-acento text-sobre-acento font-semibold' : 'bg-lamina text-tinta'}`
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
            <h1 className="min-w-0 text-[1.75rem] md:text-xl font-bold tracking-tight">
              <span className="md:hidden"><TituloSeccion respaldo={pestañaActiva} /></span>
              <span className="hidden md:inline">Perletta</span>
            </h1>

            <nav aria-label="Secciones" className="hidden md:flex gap-1 mr-auto ml-6">
              {SECCIONES.map(s => (
                <button key={s.id} onClick={() => irA(s.id)} aria-current={pestañaActiva === s.id ? 'page' : undefined} className={`min-h-11 px-4 rounded-xl font-medium ${pestañaActiva === s.id ? 'bg-lamina text-tinta' : 'text-tenue hover:text-tinta'}`}>
                  {s.nombre}
                </button>
              ))}
            </nav>

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
              <h2 className="max-md:sr-only shrink-0 text-3xl font-bold tracking-tight min-h-12 mb-5">Armario</h2>
              <GaleriaArmario onCrearConjunto={iniciarCreacionConjunto} onEditarPrenda={iniciarEdicion} onQueMePongo={() => { setPrendaFijada(null); abrirModal('que_me_pongo'); vibrar(30) }} onAnadirPrenda={() => { setModoDeseo(false); abrirModal('formulario'); vibrar(30) }} onAnadirDeseo={() => { setModoDeseo(true); abrirModal('formulario'); vibrar(30) }} onVerOutfitsDeseo={(d) => { setDeseoElegido(d); abrirModal('deseo_outfits'); vibrar(20) }} onAbrirFiltros={() => abrirModal('filtros')} onQuitarFiltro={() => setFiltroActual(null)} mostrarToast={mostrarToast} filtroCategoria={filtroActual} setDialogoGlobal={solicitarConfirmacionGlobal} onCambio={recargarVistas} />
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

        <BarraSecciones respaldo={pestañaActiva} onIr={irA} />
        <IndicadorConexion mostrarToast={mostrarToast} />
        <IndicadorCarga oculto={modalActivo === 'carga_masiva'} onAbrir={() => { abrirModal('carga_masiva'); vibrar(20) }} />
      </div>

      {modalActivo && (
        <div className="fixed inset-0 z-80 flex flex-col justify-end md:justify-center md:items-center md:p-6" inert={!!dialogoGlobal}>
          <div onClick={cerrarModal} className={`absolute inset-0 bg-velo transition-opacity duration-300 ease-ios ${modalVisible ? 'opacity-100' : 'opacity-0'}`} />
          <div ref={hojaRef} tabIndex={-1} role="dialog" aria-modal="true" className={`relative w-full md:max-w-lg max-h-[92dvh] md:max-h-[88dvh] flex flex-col bg-superficie rounded-t-3xl md:rounded-3xl pb-safe transition-[translate,opacity] duration-300 ease-ios ${modalVisible ? 'translate-y-0 opacity-100' : 'translate-y-full md:translate-y-4 md:opacity-0'}`}>
            <div ref={asaRef} className="shrink-0 h-7 flex items-center justify-center touch-none cursor-grab">
              <div className="w-10 h-1 rounded-full bg-linea md:hidden" />
            </div>
            <button onClick={cerrarModal} aria-label="Cerrar" className="boton-icono absolute! top-4 right-3 z-10">
              <Icono nombre="cerrar" />
            </button>

            <div className="min-h-0 overflow-y-auto overscroll-contain px-5 md:px-7 pt-1 pb-6">
              {/* Un solo Suspense: el asa, el velo y la X quedan fuera y siguen
                  funcionando aunque el contenido de la hoja llegue tarde. */}
              <Suspense fallback={<div role="status" aria-label="Cargando" className="flex flex-col gap-4"><div className="esqueleto h-8 w-48" />{[0, 1, 2, 3].map(i => <div key={i} className="esqueleto h-18" />)}</div>}>
                {modalActivo === 'formulario' && (
                  <FormularioPrenda deseo={modoDeseo} onVarias={() => abrirModal('carga_masiva')} onExito={() => { cerrarModal(); recargarVistas(); vibrar([50, 50]); mostrarToast(modoDeseo ? 'Añadido a tus deseos' : 'Prenda añadida', 'exito') }} />
                )}
                {modalActivo === 'editar' && prendaAEditar && <FormularioEdicion prenda={prendaAEditar} onExito={() => { cerrarModal(); recargarVistas(); vibrar([50, 50]); mostrarToast("Prenda editada", "exito") }} onCancelar={cerrarModal} />}
                {modalActivo === 'crear_maleta' && <FormularioMaleta onExito={(maleta) => {
                  cerrarModal(); recargarVistas(); vibrar([50, 50])
                  mostrarToast('Maleta creada', 'exito', maleta?.fecha_inicio ? { texto: 'Prepárala por mí', onClick: () => prepararMaleta(maleta) } : null)
                }} onCancelar={cerrarModal} />}
                {modalActivo === 'confirmar_uso' && usoPendiente && (
                  <ConfirmarUso outfit={usoPendiente} mostrarToast={mostrarToast} onHecho={() => { cerrarModal(); recargarVistas() }} />
                )}
                {modalActivo === 'asistente_maleta' && maletaAsistente && (
                  <AsistenteMaleta
                    maleta={maletaAsistente}
                    mostrarToast={mostrarToast}
                    onHecho={() => { cerrarModal(); setRefrescoMaleta(n => n + 1); setPestañaActiva('conjuntos') }}
                  />
                )}
                {modalActivo === 'crear_semana' && <FormularioSemana onExito={() => { cerrarModal(); recargarVistas(); setPestañaActiva('semana'); vibrar([50, 50]); mostrarToast("Semana creada", "exito") }} onCancelar={cerrarModal} />}
                {modalActivo === 'elegir_prendas' && objetivoSemana && (
                  <SelectorPrendas
                    fecha={objetivoSemana.fecha}
                    nombreSemana={objetivoSemana.semana.nombre}
                    onGuardar={crearOutfitSemana}
                    onCancelar={cerrarModal}
                  />
                )}

                {modalActivo === 'crear_conjunto' && (
                  <form onSubmit={guardarConjunto} className="flex flex-col gap-4">
                    <h2 className="titulo-hoja">Guardar outfit</h2>
                    <div>
                      <label htmlFor="maletaId" className="etiqueta">Maleta</label>
                      <select id="maletaId" name="maletaId" required className="campo">
                        {maletasDisponibles.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="nombreConjunto" className="etiqueta">Nombre</label>
                      <input id="nombreConjunto" type="text" name="nombreConjunto" autoComplete="off" required placeholder="Casual día 1" className="campo" />
                    </div>
                    <button type="submit" className="boton boton-primario mt-2">Guardar</button>
                  </form>
                )}

                {modalActivo === 'filtros' && (
                  <div className="flex flex-col gap-5">
                    <h2 className="titulo-hoja">Filtrar</h2>
                    <button onClick={() => aplicarFiltro(null)} aria-pressed={!filtroActual} className={`self-start ${chip(!filtroActual)}`}>Todo</button>
                    {!datosMenu && <div role="status" aria-label="Cargando" className="flex gap-2">{[0, 1, 2].map(i => <div key={i} className="esqueleto h-11 w-24" />)}</div>}
                    {datosMenu?.map(tipo => (
                      <div key={tipo.id}>
                        <h3 className="etiqueta">{tipo.nombre}</h3>
                        <div className="flex flex-wrap items-center gap-2">
                          {tipo.categorias.length === 0 && <span className="text-sm text-tenue">Sin prendas</span>}
                          {tipo.categorias.map(cat => (
                            <button key={cat.id} onClick={() => aplicarFiltro(cat)} aria-pressed={filtroActual?.id === cat.id} className={chip(filtroActual?.id === cat.id)}>{cat.nombre}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-linea">
                      <button onClick={() => abrirModal('tipos')} className="boton boton-secundario">Tipos</button>
                      <button onClick={() => abrirModal('categorias')} className="boton boton-secundario">Categorías</button>
                    </div>
                  </div>
                )}

                {modalActivo === 'que_me_pongo' && (
                  <QueMePongo
                    key={prendaFijada || 'libre'}
                    prendaInicial={prendaFijada}
                    mostrarToast={mostrarToast}
                    onHecho={() => { cerrarModal(); recargarVistas(); setPestañaActiva('semana') }}
                  />
                )}

                {modalActivo === 'deseo_outfits' && deseoElegido && <OutfitsConDeseo deseo={deseoElegido} />}

                {modalActivo === 'carga_masiva' && (
                  <CargaMasiva
                    mostrarToast={mostrarToast}
                    onGuardadas={(vacia) => { recargarVistas(); if (vacia) cerrarModal() }}
                  />
                )}

                {modalActivo === 'estadisticas' && (
                  <Estadisticas
                    mostrarToast={mostrarToast}
                    onCambio={recargarVistas}
                    onProponer={(id) => { setPrendaFijada(id); abrirModal('que_me_pongo') }}
                  />
                )}

                {modalActivo === 'ajustes' && (
                  <div className="flex flex-col gap-3">
                    <h2 className="titulo-hoja mb-2">Ajustes</h2>
                    <button role="switch" aria-checked={temaOscuro} onClick={() => { setTemaOscuro(!temaOscuro); vibrar(30) }} className="boton boton-secundario justify-between!">
                      Tema oscuro
                      <span aria-hidden="true" className={`w-11 h-6 rounded-full p-0.5 ${temaOscuro ? 'bg-acento' : 'bg-tenue'}`}>
                        <span className={`block w-5 h-5 rounded-full bg-superficie transition-transform duration-200 ${temaOscuro ? 'translate-x-5' : ''}`} />
                      </span>
                    </button>
                    <button onClick={() => { cerrarModal(); exportarDatos() }} className="boton boton-secundario justify-between!">
                      Descargar copia de seguridad
                      <Icono nombre="descargar" />
                    </button>
                    <label className="boton boton-secundario justify-between! cursor-pointer">
                      Restaurar copia de seguridad
                      <input type="file" accept=".json,application/json" onChange={alElegirCopia} className="sr-only" />
                      <Icono nombre="lista" />
                    </label>
                    <p className="text-sm text-tenue -mt-2">La copia se añade a lo que ya tienes; no borra nada. Las fotos no van dentro de la copia y solo se restaura bien en la misma cuenta (las fotos son privadas de cada cuenta).</p>
                    <div>
                      <label htmlFor="ciudadClima" className="etiqueta">Mi ciudad (para el tiempo de hoy)</label>
                      <input id="ciudadClima" type="text" autoComplete="off" placeholder="Madrid" defaultValue={ciudadGuardada()} onBlur={(e) => guardarCiudad(e.target.value)} className="campo" />
                      <p className="text-sm text-tenue mt-1">Se usa si no das permiso de ubicación.</p>
                    </div>
                    <button onClick={() => abrirModal('estadisticas')} className="boton boton-secundario justify-between!">
                      Mi armario en números
                      <Icono nombre="lista" />
                    </button>
                    <EtiquetarArmario onTerminado={recargarVistas} />
                    <ResumenUsos />
                    <div className="pt-3 mt-1 border-t border-linea">
                      <p className="text-sm text-tenue mb-2 truncate">Sesión: {sesion.user?.email}</p>
                      <button onClick={() => { cerrarModal(); supabase.auth.signOut() }} className="boton boton-secundario w-full justify-between!">
                        Cerrar sesión
                        <Icono nombre="salir" />
                      </button>
                    </div>
                    <p className="text-sm text-tenue pt-2">Perletta v3</p>
                  </div>
                )}

                {/* Le inyectamos las variables a Gestores */}
                {(modalActivo === 'tipos' || modalActivo === 'categorias') && <Gestores key={modalActivo} seccion={modalActivo} onCambio={recargarVistas} setDialogoGlobal={solicitarConfirmacionGlobal} mostrarToast={mostrarToast} />}
              </Suspense>
            </div>
          </div>
        </div>
      )}

      {/* PORTAL GLOBAL DE CONFIRMACIONES (Doble comprobación en cascada) */}
      {dialogoGlobal && (
        <div className="fixed inset-0 bg-velo z-200 flex items-center justify-center p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="titulo-dialogo" className="aparece bg-superficie rounded-3xl p-5 w-full max-w-sm max-h-full overflow-y-auto">
            <h3 id="titulo-dialogo" className="text-xl font-bold leading-snug mb-5 min-w-0 wrap-break-word">{dialogoGlobal.mensaje}</h3>
            {dialogoGlobal.contenidoAdicional}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  const fn = dialogoGlobal.onConfirm;
                  setDialogoGlobal(null);
                  if(fn) fn();
                }}
                className={`boton w-full ${dialogoGlobal.esDestructivo ? 'boton-peligro' : 'boton-primario'}`}
              >
                {dialogoGlobal.textoConfirmar || 'Confirmar'}
              </button>
              <button autoFocus onClick={() => setDialogoGlobal(null)} className="boton boton-secundario w-full">Cancelar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}