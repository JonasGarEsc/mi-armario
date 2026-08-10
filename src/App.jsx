import { useState, useEffect } from 'react'
import { useSwipeable } from 'react-swipeable'
import FormularioPrenda from './components/FormularioPrenda'
import FormularioEdicion from './components/FormularioEdicion'
import FormularioMaleta from './components/FormularioMaleta'
import GaleriaArmario from './components/GaleriaArmario'
import VistaConjuntos from './components/VistaConjuntos'
import Gestores from './components/Gestores'
import { supabase } from './supabase'

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
    localStorage.setItem('tema_armario', temaOscuro ? 'dark' : 'light')
  }, [temaOscuro])

  useEffect(() => {
    const temporizadorLimpieza = setTimeout(async () => {
      try {
        const { data: prendas } = await supabase.from('prendas').select('imagen_url')
        if (!prendas) return
        const urlsActivas = prendas.map(p => p.imagen_url.split('/').pop())
        
        const { data: archivos } = await supabase.storage.from('prendas').list()
        if (!archivos) return
        const archivosBorrables = archivos.filter(a => a.name !== '.emptyFolderPlaceholder' && !urlsActivas.includes(a.name)).map(a => a.name)

        if (archivosBorrables.length > 0) await supabase.storage.from('prendas').remove(archivosBorrables)
      } catch (error) { console.error("Fallo silencioso en limpieza.") }
    }, 5000)
    return () => clearTimeout(temporizadorLimpieza)
  }, [])

  const mostrarToast = (mensaje, tipo = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, mensaje, tipo }])
    vibrar(20)
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
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

  function iniciarEdicion(prenda) {
    setPrendaAEditar(prenda)
    abrirModal('editar')
    vibrar(30)
  }

  async function iniciarCreacionConjunto(idsSeleccionados) {
    const { data } = await supabase.from('maletas').select('*').order('nombre')
    if (!data || data.length === 0) {
      mostrarToast("Debes crear al menos una maleta primero", "error")
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
    const idsOrdenados = [...prendasParaConjunto].sort().join(',')
    
    const { data: conjuntosExistentes } = await supabase.from('conjuntos').select('id, conjunto_prenda(prenda_id)').eq('maleta_id', maleta_id)
    const esDuplicado = conjuntosExistentes.some(conj => conj.conjunto_prenda.map(cp => cp.prenda_id).sort().join(',') === idsOrdenados)

    if (esDuplicado) return mostrarToast('Combinación exacta ya existente en maleta.', 'error')

    const { data: conj, error } = await supabase.from('conjuntos').insert([{ nombre, maleta_id }]).select().single()
    if (error) return mostrarToast("Error al guardar conjunto.", "error")

    const relaciones = prendasParaConjunto.map(id => ({ conjunto_id: conj.id, prenda_id: id }))
    await supabase.from('conjunto_prenda').insert(relaciones)
    
    vibrar([50, 50])
    mostrarToast("Outfit guardado con éxito", "exito")
    cerrarModal()
    recargarVistas()
    setPestañaActiva('conjuntos')
  }

  return (
    <div className="min-h-screen bg-white in-[.modo-oscuro]:bg-[#0a0a0a] text-neutral-900 in-[.modo-oscuro]:text-neutral-100 flex flex-col w-full overflow-hidden transition-colors duration-300 font-sans">
      
      {/* Sistema Toast Profesional */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-100 flex flex-col gap-2 items-center pointer-events-none w-[90%] max-w-sm">
        {toasts.map(toast => (
          <div key={toast.id} className="animate-fade-in-up flex items-center gap-3 px-4 py-3 bg-neutral-900 in-[.modo-oscuro]:bg-white text-white in-[.modo-oscuro]:text-black rounded-xl shadow-xl w-full">
            {toast.tipo === 'exito' && <span className="text-emerald-400 in-[.modo-oscuro]:text-emerald-600">✓</span>}
            {toast.tipo === 'error' && <span className="text-red-400 in-[.modo-oscuro]:text-red-600">✕</span>}
            {toast.tipo === 'info' && <span className="text-blue-400 in-[.modo-oscuro]:text-blue-600">ℹ</span>}
            <p className="text-sm font-semibold">{toast.mensaje}</p>
          </div>
        ))}
      </div>

      <header className="bg-white/80 in-[.modo-oscuro]:bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-neutral-200/60 in-[.modo-oscuro]:border-neutral-800/60 sticky top-0 z-30 transition-colors duration-300">
        <div className="px-4 md:px-6 h-16 flex items-center justify-between max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black in-[.modo-oscuro]:bg-white rounded-xl flex items-center justify-center shadow-sm transition-colors duration-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-white in-[.modo-oscuro]:text-black">
                <path d="M12 4v2M12 6c-2.5 0-4.5 2-4.5 4.5S9 15 12 15s4.5-2 4.5-4.5S14.5 6 12 6zM5 18l7-6 7 6" />
              </svg>
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg md:text-xl font-extrabold tracking-tight leading-none">ARMARIO</h1>
              <span className="text-[10px] md:text-xs font-semibold text-neutral-500 in-[.modo-oscuro]:text-neutral-400 uppercase tracking-widest mt-0.5">Gestor Inteligente</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => { setTemaOscuro(!temaOscuro); vibrar(30); }} className="relative w-10 h-10 rounded-full bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 border border-neutral-200 in-[.modo-oscuro]:border-neutral-800 flex items-center justify-center overflow-hidden transition-colors active:scale-95 touch-manipulation">
              <div className={`absolute transition-transform duration-500 ease-in-out ${temaOscuro ? 'translate-y-10 opacity-0' : 'translate-y-0 opacity-100'}`}>
                <svg className="w-5 h-5 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              </div>
              <div className={`absolute transition-transform duration-500 ease-in-out ${temaOscuro ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}>
                <svg className="w-5 h-5 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              </div>
            </button>
            <div className="w-10 h-10 rounded-full bg-linear-to-tr from-neutral-200 to-neutral-300 in-[.modo-oscuro]:from-neutral-800 in-[.modo-oscuro]:to-neutral-700 border-2 border-white in-[.modo-oscuro]:border-neutral-900 shadow-sm overflow-hidden flex items-center justify-center cursor-pointer active:scale-95 transition-transform">
               <svg className="w-6 h-6 text-white in-[.modo-oscuro]:text-neutral-500 mt-2" fill="currentColor" viewBox="0 0 24 24"><path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
          </div>
        </div>
      </header>

      <main {...swipeNavegacion} className="flex-1 w-full relative overflow-hidden touch-pan-y pb-16 max-w-7xl mx-auto">
        <div 
          className="flex w-[200%] h-full transition-transform duration-400 ease-[cubic-bezier(0.25,1,0.5,1)] will-change-transform transform-gpu" 
          style={{ transform: pestañaActiva === 'ropa' ? 'translateX(0%)' : 'translateX(-50%)' }}
        >
          <div className="w-1/2 h-full flex flex-col overflow-y-auto hide-scrollbar p-3 md:p-6">
            <div className="flex gap-2 mb-5 shrink-0">
              <button onClick={() => { abrirModal('formulario'); vibrar(30); }} className="flex-1 bg-black in-[.modo-oscuro]:bg-white text-white in-[.modo-oscuro]:text-black font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform text-sm md:text-base">
                + Nueva Prenda
              </button>
              <button onClick={() => { abrirModal('tipos'); vibrar(30); }} className="px-5 bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 border border-transparent in-[.modo-oscuro]:border-neutral-800 font-medium py-3 rounded-xl active:scale-[0.98] transition-transform text-sm md:text-base">Tipos</button>
              <button onClick={() => { abrirModal('categorias'); vibrar(30); }} className="px-5 bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 border border-transparent in-[.modo-oscuro]:border-neutral-800 font-medium py-3 rounded-xl active:scale-[0.98] transition-transform text-sm md:text-base">Prendas</button>
            </div>
            <GaleriaArmario onCrearConjunto={iniciarCreacionConjunto} onEditarPrenda={iniciarEdicion} mostrarToast={mostrarToast} key={`g-${actualizaciones}`} />
          </div>

          <div className="w-1/2 h-full flex flex-col overflow-y-auto hide-scrollbar p-3 md:p-6">
            <VistaConjuntos onCrearMaleta={() => { abrirModal('crear_maleta'); vibrar(30); }} mostrarToast={mostrarToast} key={`c-${actualizaciones}`} />
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 w-full bg-black text-white pb-safe z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
        <div className="flex justify-around items-center h-16 max-w-7xl mx-auto">
          <button onClick={() => { setPestañaActiva('ropa'); vibrar(30); }} className={`flex-1 flex flex-col items-center justify-center h-full gap-1.5 transition-all duration-300 ${pestañaActiva === 'ropa' ? 'opacity-100 scale-105' : 'opacity-40 hover:opacity-70'}`}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2l2 4h4l2-4h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM4 10h16v10a2 2 0 01-2 2H6a2 2 0 01-2-2V10z" /></svg>
            <span className="text-[10px] font-bold tracking-wide uppercase">Ropa</span>
          </button>
          <button onClick={() => { setPestañaActiva('conjuntos'); vibrar(30); }} className={`flex-1 flex flex-col items-center justify-center h-full gap-1.5 transition-all duration-300 ${pestañaActiva === 'conjuntos' ? 'opacity-100 scale-105' : 'opacity-40 hover:opacity-70'}`}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            <span className="text-[10px] font-bold tracking-wide uppercase">Maletas</span>
          </button>
        </div>
      </nav>

      {modalActivo && (
        <div className={`fixed inset-0 bg-black/70 z-50 flex flex-col justify-end transition-opacity duration-300 ${modalVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex-1" onClick={cerrarModal}></div>
          <div className={`bg-white in-[.modo-oscuro]:bg-neutral-900 w-full rounded-t-4xl pb-10 pt-2 px-6 transition-transform duration-400 ease-[cubic-bezier(0.25,1,0.5,1)] transform-gpu will-change-transform shadow-[0_-10px_40px_rgba(0,0,0,0.2)] max-w-7xl mx-auto ${modalVisible ? 'translate-y-0' : 'translate-y-full'}`}>
            
            <div {...swipeModal} className="w-full pt-3 pb-5 flex justify-center touch-none">
              <div className="w-12 h-1.5 bg-neutral-300 in-[.modo-oscuro]:bg-neutral-700 rounded-full"></div>
            </div>
            
            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar px-1">
              {modalActivo === 'formulario' && <FormularioPrenda onExito={() => { cerrarModal(); recargarVistas(); vibrar([50, 50]); mostrarToast("Prenda añadida", "exito") }} />}
              {modalActivo === 'editar' && prendaAEditar && <FormularioEdicion prenda={prendaAEditar} onExito={() => { cerrarModal(); recargarVistas(); vibrar([50, 50]); mostrarToast("Prenda editada", "exito") }} onCancelar={cerrarModal} />}
              {modalActivo === 'crear_maleta' && <FormularioMaleta onExito={() => { cerrarModal(); recargarVistas(); vibrar([50, 50]); mostrarToast("Maleta creada", "exito") }} onCancelar={cerrarModal} />}
              
              {modalActivo === 'crear_conjunto' && (
                <form onSubmit={guardarConjunto} className="flex flex-col gap-5">
                  <h2 className="text-2xl font-bold tracking-tight mb-2">Guardar Conjunto</h2>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-neutral-700 in-[.modo-oscuro]:text-neutral-300">Destino / Maleta:</label>
                    <select name="maletaId" required className="w-full p-4 rounded-xl bg-neutral-100 in-[.modo-oscuro]:bg-neutral-800 border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-600 outline-none transition-colors">
                      {maletasDisponibles.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-neutral-700 in-[.modo-oscuro]:text-neutral-300">Nombre del Outfit:</label>
                    <input type="text" name="nombreConjunto" autoComplete="off" required placeholder="Ej. Casual día 1" className="w-full p-4 rounded-xl bg-neutral-100 in-[.modo-oscuro]:bg-neutral-800 border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-600 outline-none transition-colors" />
                  </div>
                  <button type="submit" className="mt-4 bg-black in-[.modo-oscuro]:bg-white text-white in-[.modo-oscuro]:text-black font-bold py-4 rounded-xl active:scale-[0.98] transition-transform text-lg">Guardar</button>
                </form>
              )}
              
              {(modalActivo === 'tipos' || modalActivo === 'categorias') && <Gestores seccion={modalActivo} onCambio={recargarVistas} />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}