import { useState, useEffect } from 'react'
import FormularioPrenda from './components/FormularioPrenda'
import FormularioEdicion from './components/FormularioEdicion'
import GaleriaArmario from './components/GaleriaArmario'
import VistaConjuntos from './components/VistaConjuntos'
import Gestores from './components/Gestores'
import { supabase } from './supabase'

export default function App() {
  const [pantalla, setPantalla] = useState('inicio')
  const [pestañaActiva, setPestañaActiva] = useState('ropa')
  const [actualizaciones, setActualizaciones] = useState(0)
  
  const [modalActivo, setModalActivo] = useState(null) 
  const [prendaAEditar, setPrendaAEditar] = useState(null)
  
  const [temaOscuro, setTemaOscuro] = useState(() => {
    if (typeof window !== 'undefined') {
      const temaGuardado = localStorage.getItem('tema_armario')
      if (temaGuardado) return temaGuardado === 'dark'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  useEffect(() => {
    localStorage.setItem('tema_armario', temaOscuro ? 'dark' : 'light')
  }, [temaOscuro])

  const recargarVistas = () => setActualizaciones(prev => prev + 1)
  const cerrarModal = () => {
    setModalActivo(null)
    setPrendaAEditar(null)
  }

  function iniciarEdicion(prenda) {
    setPrendaAEditar(prenda)
    setModalActivo('editar')
  }

  async function manejarCreacionConjunto(idsSeleccionados) {
    const idsOrdenados = [...idsSeleccionados].sort().join(',')
    const { data: conjuntosExistentes } = await supabase.from('conjuntos').select('id, conjunto_prenda(prenda_id)')
    const esDuplicado = conjuntosExistentes.some(conj => conj.conjunto_prenda.map(cp => cp.prenda_id).sort().join(',') === idsOrdenados)

    if (esDuplicado) return alert('Denegado: Conjunto idéntico ya existente.')
    const nombre = prompt("Nombre al conjunto:")
    if (!nombre) return

    const { data: conj, error } = await supabase.from('conjuntos').insert([{ nombre, temporada_ideal: 'Todas' }]).select().single()
    if (error) return alert("Error.")

    const relaciones = idsSeleccionados.map(id => ({ conjunto_id: conj.id, prenda_id: id }))
    await supabase.from('conjunto_prenda').insert(relaciones)
    
    recargarVistas()
    setPestañaActiva('conjuntos')
  }

  if (pantalla === 'inicio') {
    return (
      <div className={temaOscuro ? 'modo-oscuro' : ''}>
        <div className="min-h-screen bg-rose-50 [.modo-oscuro_&]:bg-slate-900 flex flex-col items-center justify-center p-6 transition-colors duration-300">
          <button 
            onClick={() => setTemaOscuro(!temaOscuro)} 
            className="absolute top-4 right-4 bg-white [.modo-oscuro_&]:bg-slate-800 text-slate-800 [.modo-oscuro_&]:text-slate-200 px-4 py-2 rounded-full shadow cursor-pointer font-bold border border-rose-100 [.modo-oscuro_&]:border-slate-700"
          >
            {temaOscuro ? '☀️ Modo Claro' : '🌙 Modo Oscuro'}
          </button>
          <h1 className="text-4xl md:text-6xl font-bold text-slate-800 [.modo-oscuro_&]:text-indigo-200 mb-8 text-center">Armario Virtual</h1>
          <button onClick={() => setPantalla('armario')} className="bg-teal-400 [.modo-oscuro_&]:bg-indigo-500 text-slate-900 [.modo-oscuro_&]:text-white text-lg md:text-xl font-bold py-4 px-8 rounded-xl cursor-pointer hover:bg-teal-500 [.modo-oscuro_&]:hover:bg-indigo-400 w-full md:w-auto shadow-lg transition-transform hover:scale-105">
            Entrar en tu armario
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={temaOscuro ? 'modo-oscuro' : ''}>
      <div className="min-h-screen bg-rose-50 [.modo-oscuro_&]:bg-slate-900 text-slate-800 [.modo-oscuro_&]:text-slate-200 flex flex-col w-full overflow-x-hidden transition-colors duration-300">
        
        <header className="bg-white [.modo-oscuro_&]:bg-slate-800 shadow-sm border-b border-rose-100 [.modo-oscuro_&]:border-slate-700 p-4 flex justify-between items-center w-full">
          <h2 className="text-xl md:text-2xl font-bold text-teal-600 [.modo-oscuro_&]:text-indigo-300">Armario Virtual</h2>
          <div className="flex gap-4 items-center">
            <button onClick={() => setTemaOscuro(!temaOscuro)} className="text-sm font-bold bg-rose-100 [.modo-oscuro_&]:bg-slate-700 px-3 py-1 rounded-full cursor-pointer hover:bg-rose-200 [.modo-oscuro_&]:hover:bg-slate-600">
              {temaOscuro ? '☀️ Claro' : '🌙 Oscuro'}
            </button>
            <button onClick={() => setPantalla('inicio')} className="text-slate-500 [.modo-oscuro_&]:text-slate-400 font-bold cursor-pointer hover:text-red-400">Salir</button>
          </div>
        </header>

        <main className="flex-1 w-full p-4 md:p-6 lg:p-8">
          <div className="flex border-b-2 border-rose-200 [.modo-oscuro_&]:border-slate-700 mb-6 gap-2 md:gap-4 overflow-x-auto w-full">
            <button onClick={() => setPestañaActiva('ropa')} className={`py-2 px-4 font-bold cursor-pointer whitespace-nowrap ${pestañaActiva === 'ropa' ? 'border-b-4 border-teal-400 [.modo-oscuro_&]:border-indigo-400 text-teal-600 [.modo-oscuro_&]:text-indigo-300' : 'text-slate-400 [.modo-oscuro_&]:text-slate-500'}`}>Mi Ropa</button>
            <button onClick={() => setPestañaActiva('conjuntos')} className={`py-2 px-4 font-bold cursor-pointer whitespace-nowrap ${pestañaActiva === 'conjuntos' ? 'border-b-4 border-teal-400 [.modo-oscuro_&]:border-indigo-400 text-teal-600 [.modo-oscuro_&]:text-indigo-300' : 'text-slate-400 [.modo-oscuro_&]:text-slate-500'}`}>Mis Conjuntos</button>
          </div>

          <div className="bg-white [.modo-oscuro_&]:bg-slate-800 p-4 md:p-6 lg:p-8 border border-rose-100 [.modo-oscuro_&]:border-slate-700 min-h-[60vh] md:min-h-[700px] rounded-2xl shadow-sm w-full">
            {pestañaActiva === 'ropa' && (
              <div className="flex flex-col h-full w-full">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4 border-b border-rose-100 [.modo-oscuro_&]:border-slate-700 pb-6 w-full">
                  <button 
                    onClick={() => setModalActivo('formulario')}
                    className="bg-teal-400 [.modo-oscuro_&]:bg-indigo-500 text-slate-900 [.modo-oscuro_&]:text-white text-base md:text-lg font-bold py-3 px-6 xl:px-8 rounded-xl cursor-pointer hover:bg-teal-500 [.modo-oscuro_&]:hover:bg-indigo-400 shadow-md transition-transform hover:scale-105 w-full xl:w-auto"
                  >
                    + Añadir Prenda
                  </button>
                  
                  <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                    <button onClick={() => setModalActivo('tipos')} className="bg-rose-100 [.modo-oscuro_&]:bg-slate-700 text-slate-700 [.modo-oscuro_&]:text-slate-200 text-sm md:text-base font-bold py-3 px-4 rounded-xl cursor-pointer hover:bg-rose-200 [.modo-oscuro_&]:hover:bg-slate-600 flex-1 xl:flex-none text-center">Tipos</button>
                    <button onClick={() => setModalActivo('categorias')} className="bg-rose-100 [.modo-oscuro_&]:bg-slate-700 text-slate-700 [.modo-oscuro_&]:text-slate-200 text-sm md:text-base font-bold py-3 px-4 rounded-xl cursor-pointer hover:bg-rose-200 [.modo-oscuro_&]:hover:bg-slate-600 flex-1 xl:flex-none text-center">Prendas</button>
                    <button onClick={() => setModalActivo('etiquetas')} className="bg-rose-100 [.modo-oscuro_&]:bg-slate-700 text-slate-700 [.modo-oscuro_&]:text-slate-200 text-sm md:text-base font-bold py-3 px-4 rounded-xl cursor-pointer hover:bg-rose-200 [.modo-oscuro_&]:hover:bg-slate-600 flex-1 xl:flex-none text-center">Etiquetas</button>
                  </div>
                </div>

                <GaleriaArmario onCrearConjunto={manejarCreacionConjunto} onEditarPrenda={iniciarEdicion} key={`g-${actualizaciones}`} />
              </div>
            )}
            
            {pestañaActiva === 'conjuntos' && <VistaConjuntos key={`c-${actualizaciones}`} />}
          </div>
        </main>

        {modalActivo && (
          <div className="fixed inset-0 bg-slate-900/40 [.modo-oscuro_&]:bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white [.modo-oscuro_&]:bg-slate-800 border border-rose-100 [.modo-oscuro_&]:border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl p-4 md:p-6 relative max-h-[95vh] overflow-y-auto">
              <button onClick={cerrarModal} className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 [.modo-oscuro_&]:hover:text-white font-bold text-2xl cursor-pointer">✕</button>
              
              {modalActivo === 'formulario' && (
                <>
                  <h2 className="text-xl md:text-2xl font-bold mb-6 border-b border-rose-100 [.modo-oscuro_&]:border-slate-700 pb-2 pr-8 text-teal-600 [.modo-oscuro_&]:text-indigo-300">Añadir Nueva Prenda</h2>
                  <FormularioPrenda onExito={() => { cerrarModal(); recargarVistas(); }} />
                </>
              )}

              {modalActivo === 'editar' && prendaAEditar && (
                <>
                  <h2 className="text-xl md:text-2xl font-bold mb-2 border-b border-rose-100 [.modo-oscuro_&]:border-slate-700 pb-2 pr-8 text-teal-600 [.modo-oscuro_&]:text-indigo-300">Editar Prenda</h2>
                  <FormularioEdicion prenda={prendaAEditar} onExito={() => { cerrarModal(); recargarVistas(); }} onCancelar={cerrarModal} />
                </>
              )}
              
              {(modalActivo === 'tipos' || modalActivo === 'categorias' || modalActivo === 'etiquetas') && (
                <Gestores seccion={modalActivo} onCambio={recargarVistas} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}