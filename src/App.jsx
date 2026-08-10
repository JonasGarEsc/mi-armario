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
      alert("Debes crear al menos una maleta en 'Mis maletas' antes de guardar ropa.")
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

    if (esDuplicado) return alert('Ya existe un conjunto con esa combinación en esta maleta.')

    const { data: conj, error } = await supabase.from('conjuntos').insert([{ nombre, maleta_id }]).select().single()
    if (error) return alert("Error al guardar conjunto.")

    const relaciones = prendasParaConjunto.map(id => ({ conjunto_id: conj.id, prenda_id: id }))
    await supabase.from('conjunto_prenda').insert(relaciones)
    
    vibrar([50, 50])
    cerrarModal()
    recargarVistas()
    setPestañaActiva('conjuntos')
  }

  return (
    <div className={`min-h-screen bg-white in-[.modo-oscuro]:bg-black text-neutral-900 in-[.modo-oscuro]:text-white flex flex-col w-full overflow-hidden transition-colors duration-300 font-sans`}>
      
      {/* Cabecera Estilo App (Minimalista) */}
      <header className="bg-white/90 in-[.modo-oscuro]:bg-black/90 backdrop-blur-md border-b border-neutral-200 in-[.modo-oscuro]:border-neutral-800 p-4 flex justify-between items-center w-full sticky top-0 z-20">
        <h1 className="text-xl font-bold tracking-tight">Armario</h1>
        <button onClick={() => { setTemaOscuro(!temaOscuro); vibrar(30); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 in-[.modo-oscuro]:bg-neutral-800 active:scale-90 transition-transform">
          {temaOscuro ? '☀️' : '🌙'}
        </button>
      </header>

      {/* Contenedor Principal Deslizable */}
      <main {...swipeNavegacion} className="flex-1 w-full relative overflow-hidden touch-pan-y pb-16">
        <div 
          className="flex w-[200%] h-full transition-transform duration-400 ease-[cubic-bezier(0.25,1,0.5,1)] will-change-transform transform-gpu" 
          style={{ transform: pestañaActiva === 'ropa' ? 'translateX(0%)' : 'translateX(-50%)' }}
        >
          {/* Pestaña: Ropa */}
          <div className="w-1/2 h-full flex flex-col overflow-y-auto hide-scrollbar p-2 md:p-4">
            <div className="flex gap-2 mb-4">
              <button onClick={() => { abrirModal('formulario'); vibrar(30); }} className="flex-1 bg-neutral-900 in-[.modo-oscuro]:bg-white text-white in-[.modo-oscuro]:text-black font-semibold py-2.5 rounded-lg active:scale-[0.98] transition-transform text-sm">
                + Nueva Prenda
              </button>
              <button onClick={() => { abrirModal('tipos'); vibrar(30); }} className="px-4 bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 font-medium py-2.5 rounded-lg active:scale-[0.98] transition-transform text-sm">Tipos</button>
              <button onClick={() => { abrirModal('categorias'); vibrar(30); }} className="px-4 bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 font-medium py-2.5 rounded-lg active:scale-[0.98] transition-transform text-sm">Prendas</button>
            </div>
            <GaleriaArmario onCrearConjunto={iniciarCreacionConjunto} onEditarPrenda={iniciarEdicion} key={`g-${actualizaciones}`} />
          </div>

          {/* Pestaña: Maletas */}
          <div className="w-1/2 h-full flex flex-col overflow-y-auto hide-scrollbar p-2 md:p-4">
            <VistaConjuntos onCrearMaleta={() => { abrirModal('crear_maleta'); vibrar(30); }} key={`c-${actualizaciones}`} />
          </div>
        </div>
      </main>

      {/* Navegación Inferior Fija (Estilo Instagram/X) */}
      <nav className="fixed bottom-0 w-full bg-white/90 in-[.modo-oscuro]:bg-black/90 backdrop-blur-md border-t border-neutral-200 in-[.modo-oscuro]:border-neutral-800 pb-safe z-20">
        <div className="flex justify-around items-center h-14">
          <button onClick={() => { setPestañaActiva('ropa'); vibrar(30); }} className={`flex-1 flex flex-col items-center justify-center h-full gap-1 transition-opacity ${pestañaActiva === 'ropa' ? 'opacity-100' : 'opacity-40'}`}>
            <span className="text-xl">👕</span>
            <span className="text-[10px] font-semibold">Ropa</span>
          </button>
          <button onClick={() => { setPestañaActiva('conjuntos'); vibrar(30); }} className={`flex-1 flex flex-col items-center justify-center h-full gap-1 transition-opacity ${pestañaActiva === 'conjuntos' ? 'opacity-100' : 'opacity-40'}`}>
            <span className="text-xl">🧳</span>
            <span className="text-[10px] font-semibold">Maletas</span>
          </button>
        </div>
      </nav>

      {/* Ventana Modal Universal */}
      {modalActivo && (
        <div className={`fixed inset-0 bg-black/60 z-50 flex flex-col justify-end transition-opacity duration-300 ${modalVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex-1" onClick={cerrarModal}></div>
          <div className={`bg-white in-[.modo-oscuro]:bg-neutral-950 w-full rounded-t-3xl pb-10 pt-2 px-4 transition-transform duration-400 ease-[cubic-bezier(0.25,1,0.5,1)] transform-gpu will-change-transform ${modalVisible ? 'translate-y-0' : 'translate-y-full'}`}>
            
            <div {...swipeModal} className="w-full pt-2 pb-4 flex justify-center touch-none">
              <div className="w-10 h-1.5 bg-neutral-300 in-[.modo-oscuro]:bg-neutral-700 rounded-full"></div>
            </div>
            
            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar px-2">
              {modalActivo === 'formulario' && <FormularioPrenda onExito={() => { cerrarModal(); recargarVistas(); vibrar([50, 50]); }} />}
              {modalActivo === 'editar' && prendaAEditar && <FormularioEdicion prenda={prendaAEditar} onExito={() => { cerrarModal(); recargarVistas(); vibrar([50, 50]); }} onCancelar={cerrarModal} />}
              {modalActivo === 'crear_maleta' && <FormularioMaleta onExito={() => { cerrarModal(); recargarVistas(); vibrar([50, 50]); }} onCancelar={cerrarModal} />}
              
              {modalActivo === 'crear_conjunto' && (
                <form onSubmit={guardarConjunto} className="flex flex-col gap-4">
                  <h2 className="text-xl font-bold tracking-tight mb-2">Guardar Conjunto</h2>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Destino / Maleta:</label>
                    <select name="maletaId" required className="w-full p-3 rounded-lg bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-700 outline-none">
                      {maletasDisponibles.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Nombre del Outfit:</label>
                    <input type="text" name="nombreConjunto" autoComplete="off" required placeholder="Ej. Casual día 1" className="w-full p-3 rounded-lg bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-700 outline-none" />
                  </div>
                  <button type="submit" className="mt-2 bg-black in-[.modo-oscuro]:bg-white text-white in-[.modo-oscuro]:text-black font-semibold py-3.5 rounded-lg active:scale-[0.98] transition-transform">Guardar</button>
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