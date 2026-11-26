import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function FormularioEdicion({ prenda, onExito, onCancelar }) {
  const [tipos, setTipos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [tipoSeleccionado, setTipoSeleccionado] = useState(prenda.categorias?.tipos?.id || '')
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(prenda.categoria_id || '')
  const [guardando, setGuardando] = useState(false)
  const [errorFormulario, setErrorFormulario] = useState('')

  useEffect(() => {
    async function cargarListas() {
      const { data: dataTipos } = await supabase.from('tipos').select('*').order('nombre')
      if (dataTipos) setTipos(dataTipos)
      const { data: dataCat } = await supabase.from('categorias').select('*').order('nombre')
      if (dataCat) setCategorias(dataCat)
    }
    cargarListas()
  }, [])

  const categoriasFiltradas = categorias.filter(c => c.tipo_id === tipoSeleccionado)

  async function manejarEdicion(e) {
    e.preventDefault()
    setGuardando(true)
    setErrorFormulario('')
    const nuevoNombre = e.target.nombrePrenda.value.trim()

    if (!nuevoNombre || !categoriaSeleccionada) {
      setErrorFormulario('Faltan datos obligatorios.')
      setGuardando(false)
      return
    }

    const { error } = await supabase.from('prendas').update({ nombre: nuevoNombre, categoria_id: categoriaSeleccionada }).eq('id', prenda.id)

    if (error) setErrorFormulario('Error al actualizar la prenda.')
    else onExito()
    
    setGuardando(false)
  }

  return (
    <form onSubmit={manejarEdicion} className="flex flex-col gap-5 text-left pb-4">
      <h2 className="font-display text-3xl md:text-4xl mb-1">Editar Prenda</h2>

      {errorFormulario && (
        <div className="flex items-center gap-3 p-4 rounded-[2px] bg-red-100 in-[.modo-oscuro]:bg-red-900/30 border border-red-200 in-[.modo-oscuro]:border-red-800 text-red-700 in-[.modo-oscuro]:text-red-400">
          <span className="text-sm font-semibold">{errorFormulario}</span>
        </div>
      )}
      
      <div className="flex justify-center mb-2">
        <div className="w-32 h-32 p-2 bg-tinta/5 rounded-[2px] border border-linea">
          <img src={prenda.imagen_url} alt="Vista previa" className="w-full h-full object-contain" />
        </div>
      </div>

      <div>
        <label className="block text-[13px] mb-2 text-tenue">Nombre descriptivo</label>
        <input type="text" name="nombrePrenda" autoComplete="off" defaultValue={prenda.nombre} required className="w-full p-4 rounded-[2px] bg-tinta/5 border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-700 outline-none transition-colors text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[13px] mb-2 text-tenue">Tipo</label>
          <select value={tipoSeleccionado} onChange={(e) => { setTipoSeleccionado(e.target.value); setCategoriaSeleccionada('') }} required className="w-full p-4 rounded-[2px] bg-tinta/5 border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-700 outline-none transition-colors text-sm">
            <option value="">Seleccionar...</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[13px] mb-2 text-tenue">Prenda Específica</label>
          <select name="categoria" value={categoriaSeleccionada} onChange={(e) => setCategoriaSeleccionada(e.target.value)} required disabled={!tipoSeleccionado} className="w-full p-4 rounded-[2px] bg-tinta/5 border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-700 outline-none transition-colors disabled:opacity-50 text-sm">
            <option value="">Seleccionar...</option>
            {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <button type="submit" disabled={guardando} className="flex-1 bg-tinta text-papel font-bold py-4 rounded-[2px] active:scale-[0.98] transition-transform text-sm disabled:opacity-70">{guardando ? 'Guardando...' : 'Actualizar'}</button>
        <button type="button" onClick={onCancelar} className="flex-1 bg-tinta/5 text-neutral-900 in-[.modo-oscuro]:text-white font-bold py-4 rounded-[2px] active:scale-[0.98] transition-transform text-sm">Cancelar</button>
      </div>
    </form>
  )
}
