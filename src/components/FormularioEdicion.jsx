import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function FormularioEdicion({ prenda, onExito, onCancelar }) {
  const [tipos, setTipos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [tipoSeleccionado, setTipoSeleccionado] = useState(prenda.categorias?.tipos?.id || '')
  const [guardando, setGuardando] = useState(false)

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
    const nuevoNombre = e.target.nombrePrenda.value.trim()
    const nuevaCategoriaId = e.target.categoria.value

    if (!nuevoNombre || !nuevaCategoriaId) {
      alert('Faltan datos obligatorios.')
      setGuardando(false)
      return
    }

    const { error } = await supabase.from('prendas').update({ nombre: nuevoNombre, categoria_id: nuevaCategoriaId }).eq('id', prenda.id)

    if (error) alert('Error al actualizar prenda.')
    else onExito()
    
    setGuardando(false)
  }

  return (
    <form onSubmit={manejarEdicion} className="flex flex-col gap-5 text-left pb-4">
      <h2 className="text-2xl font-bold tracking-tight mb-2">Editar Prenda</h2>
      
      <div className="flex justify-center mb-2">
        <div className="w-32 h-32 p-2 bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 rounded-xl border border-neutral-200 in-[.modo-oscuro]:border-neutral-800">
          <img src={prenda.imagen_url} alt="Vista previa" className="w-full h-full object-contain" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-neutral-700 in-[.modo-oscuro]:text-neutral-300">Nombre descriptivo</label>
        <input type="text" name="nombrePrenda" autoComplete="off" defaultValue={prenda.nombre} required className="w-full p-4 rounded-xl bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-700 outline-none transition-colors text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2 text-neutral-700 in-[.modo-oscuro]:text-neutral-300">Tipo</label>
          <select value={tipoSeleccionado} onChange={(e) => setTipoSeleccionado(e.target.value)} required className="w-full p-4 rounded-xl bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-700 outline-none transition-colors text-sm">
            <option value="">Seleccionar...</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2 text-neutral-700 in-[.modo-oscuro]:text-neutral-300">Prenda Específica</label>
          <select name="categoria" defaultValue={prenda.categoria_id} required disabled={!tipoSeleccionado} className="w-full p-4 rounded-xl bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-700 outline-none transition-colors disabled:opacity-50 text-sm">
            <option value="">Seleccionar...</option>
            {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <button type="submit" disabled={guardando} className="flex-1 bg-black in-[.modo-oscuro]:bg-white text-white in-[.modo-oscuro]:text-black font-bold py-4 rounded-xl active:scale-[0.98] transition-transform text-sm disabled:opacity-70">{guardando ? 'Guardando...' : 'Actualizar'}</button>
        <button type="button" onClick={onCancelar} className="flex-1 bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 text-neutral-900 in-[.modo-oscuro]:text-white font-bold py-4 rounded-xl active:scale-[0.98] transition-transform text-sm">Cancelar</button>
      </div>
    </form>
  )
}