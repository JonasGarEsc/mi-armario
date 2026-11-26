import { useState, useEffect, lazy, Suspense } from 'react'
import { useSwipeable } from 'react-swipeable'
import FormularioEdicion from './components/FormularioEdicion'
import FormularioMaleta from './components/FormularioMaleta'
import GaleriaArmario from './components/GaleriaArmario'
import VistaConjuntos from './components/VistaConjuntos'
import Gestores from './components/Gestores'
import { supabase } from './supabase'
import { esDuplicado } from './lib/outfits'

// El motor de recorte pesa cientos de kB: solo se descarga al abrir el formulario.
const FormularioPrenda = lazy(() => import('./components/FormularioPrenda'))

export const vibrar = (ms = 50) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms)
}

export default function App() {
  const [pestañaActiva, setPestañaActiva] = useState('ropa')
  const [actualizaciones, setActualizaciones] = useState(0)
  
  const [modalActivo, setModalActivo] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  
  const [prendaAEditar, setPrendaAEditar] = useState(null)
  const [prendasParaConjunto, setPrendasParaConjunto] = useState([])
  const [maletasDisponibles, setMaletasDisponibles] = useState([])

  const [toasts, setToasts] = useState([])
  
  const [menuLateralVisible, setMenuLateralVisible] = useState(false)
  const [datosMenu, setDatosMenu] = useState([])
  const [tipoExpandido, setTipoExpandido] = useState(null)
  const [filtroActual, setFiltroActual] = useState(null)

  const [dialogoGlobal, setDialogoGlobal] = useState(null)
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false)

  const [temaOscuro, setTemaOscuro] = useState(() => {
    if (typeof window !== 'undefined') {
      const temaGuardado = localStorage.getItem('tema_armario')
      if (temaGuardado) return temaGuardado === 'dark'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  useEffect(() => {
    const root = document.documentElement
    if (temaOscuro) root.classList.add('modo-oscuro')
    else root.classList.remove('modo-oscuro')
    root.style.colorScheme = temaOscuro ? 'dark' : 'light'
    localStorage.setItem('tema_armario', temaOscuro ? 'dark' : 'light')
    // El tema lo elige el usuario, no el sistema: las dos etiquetas siguen esa decisión.
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
      meta.removeAttribute('media')
      meta.setAttribute('content', temaOscuro ? '#12100e' : '#f6f3ee')
    })
  }, [temaOscuro])

  useEffect(() => {
    if (!menuLateralVisible) return
    async function cargarDatosMenu() {
      const { data: tipos } = await supabase.from('tipos').select('*').order('nombre')
      const { data: categorias } = await supabase.from('categorias').select('*').order('nombre')
      if (tipos && categorias) {
         const menuEstructurado = tipos.map(t => ({
           ...t,
           categorias: categorias.filter(c => c.tipo_id === t.id)
         }))
         setDatosMenu(menuEstructurado)
      }
    }
    cargarDatosMenu()
  }, [menuLateralVisible, actualizaciones])

  const mostrarToast = (mensaje, tipo = 'info', accion = null) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, mensaje, tipo, accion }])
    vibrar(20)
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, accion ? 7000 : 3500)
  }

  const cerrarToast = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  // Copia de seguridad manual: las cuatro tablas, en un JSON que se descarga.
  async function exportarDatos() {
    const tablas = ['categorias', 'tipos', 'prendas', 'maletas', 'conjuntos', 'conjunto_prenda']
    const copia = { exportado_en: new Date().toISOString(), version: 2 }
    for (const tabla of tablas) {
      const { data, error } = await supabase.from(tabla).select('*')
      if (error) return mostrarToast(`No se pudo exportar ${tabla}`, 'error')
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

  const recargarVistas = () => setActualizaciones(prev => prev + 1)
  
  const abrirModal = (tipo) => {
    setModalActivo(tipo)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setModalVisible(true))
    })
  }

  const cerrarModal = () => {
    setModalVisible(false)
    setTimeout(() => {
      setModalActivo(null)
      setPrendaAEditar(null)
      setPrendasParaConjunto([])
    }, 300) 
  }

  const solicitarConfirmacionGlobal = (config) => {
    vibrar(30)
    setDialogoGlobal(config)
  }

  const swipeNavegacion = useSwipeable({
    onSwipedLeft: () => { setPestañaActiva('conjuntos'); vibrar(30); },
    onSwipedRight: () => { setPestañaActiva('ropa'); vibrar(30); },
    preventScrollOnSwipe: false,
    trackMouse: false,
    delta: 50
  })

  const swipeModal = useSwipeable({
    onSwipedDown: () => cerrarModal(),
    preventScrollOnSwipe: true,
    delta: 20,
    trackTouch: true
  })

  const swipeMenuLateral = useSwipeable({
    onSwipedLeft: () => setMenuLateralVisible(false),
    preventScrollOnSwipe: true,
    delta: 30,
    trackTouch: true
  })

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
    
    const { data: conjuntosExistentes, error: errConsulta } = await supabase.from('conjuntos').select('id, conjunto_prenda(prenda_id)').eq('maleta_id', maleta_id)
    if (errConsulta) return mostrarToast('No se pudo comprobar duplicados', 'error')
    if (esDuplicado(conjuntosExistentes, prendasParaConjunto)) return mostrarToast('Esa combinación ya existe', 'error')

    // Una sola llamada: si falla, no queda un outfit vacío.
    const { error } = await supabase.from('conjuntos').insert([{
      nombre,
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

  const aplicarFiltro = (idCategoria) => {
    setFiltroActual(idCategoria)
    setPestañaActiva('ropa')
    setMenuLateralVisible(false)
    vibrar(15)
  }

  return (
    <div className="h-dvh bg-papel text-tinta flex flex-col w-full overflow-hidden transition-colors duration-300 font-sans">

      <div className="fixed top-safe mt-4 left-0 w-full z-200 flex flex-col gap-3 items-center pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="animate-pop-in flex items-stretch bg-papel border border-linea shadow-[0_10px_30px_rgba(23,20,15,0.12)] w-max max-w-[92%] pointer-events-auto">
            <div className={`w-1 shrink-0 ${toast.tipo === 'exito' ? 'bg-acento' : toast.tipo === 'error' ? 'bg-red-700' : 'bg-tenue'}`} />
            <p className="text-[13px] md:text-sm px-4 py-3">{toast.mensaje}</p>
            {toast.accion && (
              <button
                onClick={() => { cerrarToast(toast.id); toast.accion.onClick() }}
                className="px-4 text-[13px] font-medium text-acento border-l border-linea active:opacity-60"
              >
                {toast.accion.texto}
              </button>
            )}
          </div>
        ))}
      </div>

      <header className="bg-papel border-b border-linea shrink-0 z-30 transition-colors duration-300">
        <div className="px-4 md:px-8 h-16 md:h-20 flex items-center justify-between max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={() => { setMenuLateralVisible(true); vibrar(20); }} aria-label="Abrir menú de categorías" className="w-10 h-10 flex items-center justify-center -ml-2 text-tinta active:opacity-60 transition-opacity touch-manipulation">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h10" /></svg>
            </button>
            <button onClick={() => { setPestañaActiva('ropa'); setFiltroActual(null) }} className="text-left" aria-label="Ir al armario">
              <span className="font-display text-2xl md:text-3xl leading-none tracking-tight">Perletta</span>
            </button>
          </div>

          <div className="flex items-center gap-1 md:gap-2 relative">
            <button onClick={() => { setTemaOscuro(!temaOscuro); vibrar(30); }} aria-label={temaOscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} aria-pressed={temaOscuro} className="w-10 h-10 flex items-center justify-center text-tenue active:opacity-60 transition-opacity touch-manipulation">
              {temaOscuro
                ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
            </button>
            <button
              onClick={() => { setAjustesAbiertos(!ajustesAbiertos); vibrar(30) }}
              aria-label="Menú de ajustes"
              aria-expanded={ajustesAbiertos}
              className="w-10 h-10 rounded-full border border-linea overflow-hidden flex items-center justify-center text-tenue active:opacity-60 transition-opacity touch-manipulation"
            >
               <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </button>

            {ajustesAbiertos && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAjustesAbiertos(false)} />
                <div className="absolute right-0 top-12 z-50 w-64 bg-papel border border-linea shadow-2xl overflow-hidden animate-pop-in">
                  <p className="px-5 py-4 font-display text-xl border-b border-linea">Ajustes</p>
                  <button onClick={() => { setTemaOscuro(!temaOscuro); setAjustesAbiertos(false) }} className="w-full text-left px-5 py-3.5 text-sm active:bg-tinta/5 transition-colors">
                    {temaOscuro ? 'Usar tema claro' : 'Usar tema oscuro'}
                  </button>
                  <button onClick={() => { setAjustesAbiertos(false); exportarDatos() }} className="w-full text-left px-5 py-3.5 text-sm border-t border-linea active:bg-tinta/5 transition-colors">
                    Descargar copia de seguridad
                  </button>
                  <p className="px-5 py-3 text-[11px] text-tenue border-t border-linea">Perletta v2</p>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className={`fixed inset-0 bg-black/50 z-50 transition-opacity duration-300 ${menuLateralVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setMenuLateralVisible(false)}>
        <div {...swipeMenuLateral} className={`absolute top-0 left-0 h-full w-[86%] max-w-sm bg-papel border-r border-linea shadow-2xl transform transition-transform duration-400 ease-[cubic-bezier(0.25,1,0.5,1)] flex flex-col ${menuLateralVisible ? 'translate-x-0' : '-translate-x-full'}`} onClick={e => e.stopPropagation()}>
          <div className="px-6 py-5 border-b border-linea flex justify-between items-center">
            <p className="font-display text-2xl leading-none">Perletta</p>
            <button onClick={() => setMenuLateralVisible(false)} aria-label="Cerrar menú" className="text-tenue active:opacity-60 transition-opacity touch-manipulation">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5 hide-scrollbar">
            <button onClick={() => aplicarFiltro(null)} className={`text-left font-display text-2xl leading-none transition-colors touch-manipulation ${filtroActual === null ? 'text-tinta' : 'text-tenue'}`}>Todo</button>
            {datosMenu.length === 0 && <p className="text-sm text-tenue">Cargando…</p>}
            {datosMenu.map(tipo => (
              <div key={tipo.id} className="flex flex-col">
                <button onClick={() => { setTipoExpandido(tipoExpandido === tipo.id ? null : tipo.id); vibrar(15); }} className={`text-left font-display text-xl leading-none active:opacity-60 transition-colors touch-manipulation ${tipoExpandido === tipo.id ? 'text-tinta' : 'text-tenue'}`}>
                  {tipo.nombre}
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out flex flex-col ${tipoExpandido === tipo.id ? 'max-h-125 mt-3 opacity-100 gap-2.5' : 'max-h-0 mt-0 opacity-0 gap-0'}`}>
                  {tipo.categorias.length === 0 && <span className="text-[13px] text-tenue pl-4">Sin prendas</span>}
                  {tipo.categorias.map(cat => {
                    const estaSeleccionado = filtroActual === cat.id;
                    return (
                      <button key={cat.id} onClick={() => aplicarFiltro(cat.id)} className={`text-left text-sm py-1 transition-colors touch-manipulation ${estaSeleccionado ? 'border-l-2 border-acento pl-3 text-acento' : 'border-l border-linea pl-4 text-tenue active:text-tinta'}`}>
                        {cat.nombre}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <main {...swipeNavegacion} className="flex-1 w-full relative overflow-hidden max-w-7xl mx-auto flex flex-col pb-20 md:pb-24">
        <div className="flex w-[200%] h-full transition-transform duration-400 ease-[cubic-bezier(0.25,1,0.5,1)] will-change-transform transform-gpu" style={{ transform: pestañaActiva === 'ropa' ? 'translateX(0%)' : 'translateX(-50%)' }}>
          <div className="w-1/2 min-w-0 h-full flex flex-col overflow-y-auto overscroll-y-contain hide-scrollbar px-4 md:px-8 pt-5 md:pt-8 pb-6 touch-pan-y relative z-10">
            <div className="flex items-end justify-between gap-4 mb-6 md:mb-8 shrink-0">
              <h2 className="font-display text-3xl md:text-6xl leading-none">Armario</h2>
              <div className="flex items-center gap-3 md:gap-4 pb-1">
                <button onClick={() => { abrirModal('tipos'); vibrar(30); }} className="text-[12px] md:text-sm text-tenue hover:text-tinta active:opacity-60 transition-colors touch-manipulation whitespace-nowrap">Tipos</button>
                <button onClick={() => { abrirModal('categorias'); vibrar(30); }} className="text-[12px] md:text-sm text-tenue hover:text-tinta active:opacity-60 transition-colors touch-manipulation whitespace-nowrap">Categorías</button>
                <button onClick={() => { abrirModal('formulario'); vibrar(30); }} className="bg-tinta text-papel text-[13px] md:text-sm px-3 md:px-5 py-2.5 md:py-3 active:opacity-80 transition-opacity touch-manipulation whitespace-nowrap"><span className="sm:hidden">Añadir</span><span className="hidden sm:inline">Añadir prenda</span></button>
              </div>
            </div>
            <GaleriaArmario onCrearConjunto={iniciarCreacionConjunto} onEditarPrenda={iniciarEdicion} onAnadirPrenda={() => { abrirModal('formulario'); vibrar(30); }} mostrarToast={mostrarToast} filtroCategoria={filtroActual} setDialogoGlobal={solicitarConfirmacionGlobal} key={`g-${actualizaciones}`} />
          </div>
          <div className="w-1/2 min-w-0 h-full flex flex-col overflow-y-auto overscroll-y-contain hide-scrollbar px-4 md:px-8 pt-5 md:pt-8 pb-6 touch-pan-y relative z-10">
            <VistaConjuntos onCrearMaleta={() => { abrirModal('crear_maleta'); vibrar(30); }} mostrarToast={mostrarToast} setDialogoGlobal={solicitarConfirmacionGlobal} key={`c-${actualizaciones}`} />
          </div>
        </div>
      </main>

      <nav aria-label="Secciones" className="fixed bottom-0 inset-x-0 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:bottom-6 bg-papel/95 backdrop-blur-md border-t md:border border-linea pb-safe md:pb-0 z-40 shadow-[0_-4px_24px_rgba(23,20,15,0.06)]">
        <div className="flex justify-around items-center h-16 md:gap-2 md:px-2">
          <button onClick={() => { setPestañaActiva('ropa'); vibrar(30); }} aria-current={pestañaActiva === 'ropa'} className={`flex-1 md:flex-none md:px-6 flex flex-col md:flex-row items-center justify-center h-full gap-1 md:gap-2 transition-colors duration-300 touch-manipulation ${pestañaActiva === 'ropa' ? 'text-acento' : 'text-tenue hover:text-tinta'}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2l2 4h4l2-4h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM4 10h16v10a2 2 0 01-2 2H6a2 2 0 01-2-2V10z" /></svg>
            <span className="text-[11px] md:text-xs">Armario</span>
          </button>
          <button onClick={() => { setPestañaActiva('conjuntos'); vibrar(30); }} aria-current={pestañaActiva === 'conjuntos'} className={`flex-1 md:flex-none md:px-6 flex flex-col md:flex-row items-center justify-center h-full gap-1 md:gap-2 transition-colors duration-300 touch-manipulation ${pestañaActiva === 'conjuntos' ? 'text-acento' : 'text-tenue hover:text-tinta'}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            <span className="text-[11px] md:text-xs">Maletas</span>
          </button>
        </div>
      </nav>

      {modalActivo && (
        <div className={`fixed inset-0 bg-black/70 z-80 flex flex-col justify-end md:justify-center md:items-center transition-opacity duration-300 ${modalVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex-1 md:hidden" onClick={cerrarModal}></div>
          <div className={`bg-papel border-t md:border border-linea w-full md:max-w-2xl md:max-h-[88vh] overflow-hidden pb-10 md:pb-8 pt-2 px-6 md:px-10 transition-transform duration-400 ease-[cubic-bezier(0.25,1,0.5,1)] transform-gpu will-change-transform shadow-[0_-10px_40px_rgba(0,0,0,0.2)] ${modalVisible ? 'translate-y-0' : 'translate-y-full'}`}>

            <div {...swipeModal} className="w-full pt-3 pb-5 flex justify-center touch-none md:hidden">
              <div className="w-12 h-1 bg-linea rounded-full"></div>
            </div>

            <div className="max-h-[80vh] overflow-y-auto hide-scrollbar px-1 md:py-4">
              {modalActivo === 'formulario' && (
                <Suspense fallback={<div className="py-16 text-center text-sm text-tenue">Cargando editor…</div>}>
                  <FormularioPrenda onExito={() => { cerrarModal(); recargarVistas(); vibrar([50, 50]); mostrarToast("Prenda añadida", "exito") }} />
                </Suspense>
              )}
              {modalActivo === 'editar' && prendaAEditar && <FormularioEdicion prenda={prendaAEditar} onExito={() => { cerrarModal(); recargarVistas(); vibrar([50, 50]); mostrarToast("Prenda editada", "exito") }} onCancelar={cerrarModal} />}
              {modalActivo === 'crear_maleta' && <FormularioMaleta onExito={() => { cerrarModal(); recargarVistas(); vibrar([50, 50]); mostrarToast("Maleta creada", "exito") }} onCancelar={cerrarModal} />}

              {modalActivo === 'crear_conjunto' && (
                <form onSubmit={guardarConjunto} className="flex flex-col gap-5">
                  <h2 className="font-display text-3xl md:text-4xl mb-1">Guardar outfit</h2>
                  <div>
                    <label htmlFor="maletaId" className="block text-[13px] mb-2 text-tenue">Maleta</label>
                    <select id="maletaId" name="maletaId" required className="campo">
                      {maletasDisponibles.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="nombreConjunto" className="block text-[13px] mb-2 text-tenue">Nombre</label>
                    <input id="nombreConjunto" type="text" name="nombreConjunto" autoComplete="off" required placeholder="Casual día 1" className="campo" />
                  </div>
                  <button type="submit" className="mt-3 bg-tinta text-papel py-3.5 active:opacity-80 transition-opacity touch-manipulation">Guardar</button>
                </form>
              )}

              {/* Le inyectamos las variables a Gestores */}
              {(modalActivo === 'tipos' || modalActivo === 'categorias') && <Gestores seccion={modalActivo} onCambio={recargarVistas} setDialogoGlobal={solicitarConfirmacionGlobal} mostrarToast={mostrarToast} />}
            </div>
          </div>
        </div>
      )}

      {/* PORTAL GLOBAL DE CONFIRMACIONES (Doble comprobación en cascada) */}
      {dialogoGlobal && (
        <div className="fixed inset-0 bg-black/60 z-300 flex items-center justify-center p-4">
          <div className="bg-papel border border-linea p-6 md:p-8 w-full max-w-sm shadow-2xl animate-pop-in">
            <h3 className="font-display text-2xl leading-tight mb-6">{dialogoGlobal.mensaje}</h3>
            {dialogoGlobal.contenidoAdicional}
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => {
                  const fn = dialogoGlobal.onConfirm;
                  setDialogoGlobal(null);
                  if(fn) fn();
                }}
                className={`w-full text-papel py-3 transition-opacity active:opacity-80 touch-manipulation ${dialogoGlobal.esDestructivo ? 'bg-red-700' : 'bg-tinta'}`}
              >
                {dialogoGlobal.textoConfirmar || 'Confirmar'}
              </button>
              <button onClick={() => setDialogoGlobal(null)} className="w-full py-3 border border-linea active:bg-tinta/5 transition-colors touch-manipulation">Cancelar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}