import { useState, useEffect } from 'react'
import FormularioPrenda from './components/FormularioPrenda'
import FormularioEdicion from './components/FormularioEdicion'
import FormularioMaleta from './components/FormularioMaleta'
import GaleriaArmario from './components/GaleriaArmario'
import VistaConjuntos from './components/VistaConjuntos'
import Gestores from './components/Gestores'
import { supabase } from './supabase'

export default function App() {
  const [pestañaActiva, setPestañaActiva] = useState('ropa')
  const [actualizaciones, setActualizaciones] = useState(0)
  
  const [modalActivo, setModalActivo] = useState(null) 
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

  const recargarVistas = () => setActualizaciones(prev => prev + 1)
  const cerrarModal = () => {
    setModalActivo(null)
    setPrendaAEditar(null)
    setPrendasParaConjunto([])
  }

  function iniciarEdicion(prenda) {
    setPrendaAEditar(prenda)
    setModalActivo('editar')
  }

  async function iniciarCreacionConjunto(idsSeleccionados) {
    const { data } = await supabase.from('maletas').select('*').order('nombre')
    if (!data || data.length === 0) {
      alert("Debes crear al menos una maleta en la pestaña 'Mis Viajes' antes de guardar ropa.")
      return
    }
    setMaletasDisponibles(data)
    setPrendasParaConjunto(idsSeleccionados)
    setModalActivo('crear_conjunto')
  }

  async function guardarConjunto(e) {
    e.preventDefault()
    const nombre = e.target.nombreConjunto.value.trim()
    const maleta_id = e.target.maletaId.value

    const idsOrdenados = [...prendasParaConjunto].sort().join(',')
    const { data: conjuntosExistentes } = await supabase.from('conjuntos').select('id, conjunto_prenda(prenda_id)')
    const esDuplicado = conjuntosExistentes.some(conj => conj.conjunto_prenda.map(cp => cp.prenda_id).sort().join(',') === idsOrdenados)

    if (esDuplicado) return alert('Denegado: Ya existe un conjunto con esa combinación exacta.')

    const { data: conj, error } = await supabase.from('conjuntos').insert([{ nombre, maleta_id }]).select().single()
    if (error) return alert("Error al guardar conjunto.")

    const relaciones = prendasParaConjunto.map(id => ({ conjunto_id: conj.id, prenda_id: id }))
    await supabase.from('conjunto_prenda').insert(relaciones)
    
    cerrarModal()
    recargarVistas()
    setPestañaActiva('conjuntos')
  }

  return (
    <div className={temaOscuro ? 'modo-oscuro' : ''}>
      <div className="min-h-screen bg-linear-to-br from-rose-50 via-white to-teal-50 in-[.modo-oscuro_&]:from-slate-900 in-[.modo-oscuro_&]:via-slate-800 in-[.modo-oscuro_&]:to-indigo-950 text-slate-800 in-[.modo-oscuro_&]:text-slate-200 flex flex-col w-full overflow-x-hidden transition-colors duration-500">
        <header className="bg-white/70 backdrop-blur-md in-[.modo-oscuro_&]:bg-slate-900/70 shadow-sm border-b border-rose-100/50 in-[.modo-oscuro_&]:border-slate-700/50 p-3 md:p-4 flex justify-between items-center w-full sticky top-0 z-10">
          <h2 className="text-lg md:text-2xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-teal-500 to-rose-400 in-[.modo-oscuro_&]:from-indigo-300 in-[.modo-oscuro_&]:to-purple-400">Armario Virtual</h2>
          <button onClick={() => setTemaOscuro(!temaOscuro)} className="text-xs md:text-sm font-bold bg-white/50 in-[.modo-oscuro_&]:bg-slate-800/50 border border-rose-100 in-[.modo-oscuro_&]:border-slate-700 px-3 py-1.5 rounded-full cursor-pointer hover:bg-white in-[.modo-oscuro_&]:hover:bg-slate-700 shadow-sm active:scale-95 transition-transform">
            {temaOscuro ? '☀️ Claro' : '🌙 Oscuro'}
          </button>
        </header>

        <main className="flex-1 w-full p-2 md:p-6 lg:p-8">
          <div className="flex border-b-2 border-rose-200/50 in-[.modo-oscuro_&]:border-slate-700/50 mb-4 md:mb-6 gap-2 md:gap-4 overflow-x-auto w-full hide-scrollbar">
            <button onClick={() => setPestañaActiva('ropa')} className={`py-2.5 px-4 font-bold cursor-pointer whitespace-nowrap transition-all active:scale-95 text-sm md:text-base ${pestañaActiva === 'ropa' ? 'border-b-4 border-teal-400 in-[.modo-oscuro_&]:border-indigo-400 text-teal-600 in-[.modo-oscuro_&]:text-indigo-300' : 'text-slate-400 in-[.modo-oscuro_&]:text-slate-500 hover:text-slate-600 in-[.modo-oscuro_&]:hover:text-slate-300'}`}>Mi Ropa</button>
            <button onClick={() => setPestañaActiva('conjuntos')} className={`py-2.5 px-4 font-bold cursor-pointer whitespace-nowrap transition-all active:scale-95 text-sm md:text-base ${pestañaActiva === 'conjuntos' ? 'border-b-4 border-teal-400 in-[.modo-oscuro_&]:border-indigo-400 text-teal-600 in-[.modo-oscuro_&]:text-indigo-300' : 'text-slate-400 in-[.modo-oscuro_&]:text-slate-500 hover:text-slate-600 in-[.modo-oscuro_&]:hover:text-slate-300'}`}>Mis Viajes</button>
          </div>

          <div className="bg-white/60 backdrop-blur-sm in-[.modo-oscuro_&]:bg-slate-800/60 p-3 md:p-6 lg:p-8 border border-white/50 in-[.modo-oscuro_&]:border-slate-700/50 min-h-[70vh] md:min-h-175 rounded-3xl md:rounded-3xl shadow-xl shadow-rose-100/20 in-[.modo-oscuro_&]:shadow-black/20 w-full">
            {pestañaActiva === 'ropa' && (
              <div className="flex flex-col h-full w-full">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-4 md:mb-6 gap-3 md:gap-4 border-b border-rose-100/50 in-[.modo-oscuro_&]:border-slate-700/50 pb-4 md:pb-6 w-full">
                  <button onClick={() => setModalActivo('formulario')} className="bg-linear-to-r from-teal-400 to-teal-300 in-[.modo-oscuro_&]:from-indigo-500 in-[.modo-oscuro_&]:to-indigo-400 text-slate-900 in-[.modo-oscuro_&]:text-white text-sm md:text-lg font-bold py-3 px-6 xl:px-8 rounded-xl md:rounded-2xl cursor-pointer hover:opacity-90 shadow-lg shadow-teal-200/50 in-[.modo-oscuro_&]:shadow-indigo-900/50 transition-all active:scale-95 w-full xl:w-auto border border-white/20">
                    + Añadir Prenda
                  </button>
                  <div className="flex w-full xl:w-auto gap-2">
                    <button onClick={() => setModalActivo('tipos')} className="bg-white/80 in-[.modo-oscuro_&]:bg-slate-700/80 text-slate-700 in-[.modo-oscuro_&]:text-slate-200 text-xs md:text-base font-bold py-2.5 md:py-3 px-4 rounded-xl cursor-pointer hover:bg-rose-50 in-[.modo-oscuro_&]:hover:bg-slate-600 flex-1 xl:flex-none text-center shadow-sm border border-rose-100 in-[.modo-oscuro_&]:border-slate-600 active:scale-95 transition-transform">Tipos</button>
                    <button onClick={() => setModalActivo('categorias')} className="bg-white/80 in-[.modo-oscuro_&]:bg-slate-700/80 text-slate-700 in-[.modo-oscuro_&]:text-slate-200 text-xs md:text-base font-bold py-2.5 md:py-3 px-4 rounded-xl cursor-pointer hover:bg-rose-50 in-[.modo-oscuro_&]:hover:bg-slate-600 flex-1 xl:flex-none text-center shadow-sm border border-rose-100 in-[.modo-oscuro_&]:border-slate-600 active:scale-95 transition-transform">Prendas</button>
                  </div>
                </div>
                <GaleriaArmario onCrearConjunto={iniciarCreacionConjunto} onEditarPrenda={iniciarEdicion} key={`g-${actualizaciones}`} />
              </div>
            )}
            {pestañaActiva === 'conjuntos' && <VistaConjuntos onCrearMaleta={() => setModalActivo('crear_maleta')} key={`c-${actualizaciones}`} />}
          </div>
        </main>

        {modalActivo && (
          <div className="fixed inset-0 bg-rose-900/30 in-[.modo-oscuro_&]:bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 backdrop-blur-sm transition-opacity">
            <div className="bg-white/95 in-[.modo-oscuro_&]:bg-slate-800/95 border-t sm:border border-white/50 in-[.modo-oscuro_&]:border-slate-700 rounded-t-4xl sm:rounded-3xl shadow-2xl shadow-rose-900/30 w-full max-w-2xl p-5 sm:p-8 relative max-h-[90vh] overflow-y-auto animate-slide-up">
              
              <div className="w-10 h-1 bg-slate-300 in-[.modo-oscuro_&]:bg-slate-600 rounded-full mx-auto mb-5 sm:hidden"></div>
              
              <button onClick={cerrarModal} className="absolute top-5 right-5 bg-rose-50 in-[.modo-oscuro_&]:bg-slate-700 text-slate-400 hover:text-rose-500 w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg cursor-pointer transition-all active:scale-90">✕</button>
              
              {modalActivo === 'formulario' && (
                <>
                  <h2 className="text-lg md:text-2xl font-bold mb-5 border-b border-rose-100 in-[.modo-oscuro_&]:border-slate-700 pb-2 pr-8 text-teal-600 in-[.modo-oscuro_&]:text-indigo-300">Añadir Prenda</h2>
                  <FormularioPrenda onExito={() => { cerrarModal(); recargarVistas(); }} />
                </>
              )}

              {modalActivo === 'editar' && prendaAEditar && (
                <>
                  <h2 className="text-lg md:text-2xl font-bold mb-2 border-b border-rose-100 in-[.modo-oscuro_&]:border-slate-700 pb-2 pr-8 text-teal-600 in-[.modo-oscuro_&]:text-indigo-300">Editar Prenda</h2>
                  <FormularioEdicion prenda={prendaAEditar} onExito={() => { cerrarModal(); recargarVistas(); }} onCancelar={cerrarModal} />
                </>
              )}

              {modalActivo === 'crear_maleta' && (
                <>
                  <h2 className="text-lg md:text-2xl font-bold mb-2 border-b border-rose-100 in-[.modo-oscuro_&]:border-slate-700 pb-2 pr-8 text-teal-600 in-[.modo-oscuro_&]:text-indigo-300">Diseñar Maleta</h2>
                  <FormularioMaleta onExito={() => { cerrarModal(); recargarVistas(); }} onCancelar={cerrarModal} />
                </>
              )}

              {modalActivo === 'crear_conjunto' && (
                <form onSubmit={guardarConjunto} className="flex flex-col gap-4 mt-2">
                  <h2 className="text-lg md:text-2xl font-bold mb-4 border-b border-rose-100 in-[.modo-oscuro_&]:border-slate-700 pb-2 text-teal-600 in-[.modo-oscuro_&]:text-indigo-300">Guardar Conjunto</h2>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 in-[.modo-oscuro_&]:text-slate-200 mb-1">Destino / Maleta:</label>
                    <select name="maletaId" required className="w-full p-3 rounded-xl bg-rose-50 in-[.modo-oscuro_&]:bg-slate-700 border border-rose-200 in-[.modo-oscuro_&]:border-slate-600 cursor-pointer text-slate-800 outline-none focus:ring-2 focus:ring-teal-400">
                      {maletasDisponibles.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 in-[.modo-oscuro_&]:text-slate-200 mb-1">Nombre del Outfit:</label>
                    <input type="text" name="nombreConjunto" required placeholder="Ej. Cena de gala..." className="w-full p-3 rounded-xl border border-rose-200 in-[.modo-oscuro_&]:border-slate-600 bg-rose-50 in-[.modo-oscuro_&]:bg-slate-700 text-slate-800 outline-none focus:ring-2 focus:ring-teal-400" />
                  </div>
                  <button type="submit" className="mt-4 bg-teal-400 in-[.modo-oscuro_&]:bg-indigo-500 text-slate-900 in-[.modo-oscuro_&]:text-white font-bold py-3 rounded-xl cursor-pointer hover:bg-teal-500 shadow-lg transition-transform active:scale-95">
                    Guardar
                  </button>
                </form>
              )}
              
              {(modalActivo === 'tipos' || modalActivo === 'categorias') && (
                <Gestores seccion={modalActivo} onCambio={recargarVistas} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}