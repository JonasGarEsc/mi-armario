import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Gestores({ seccion, onCambio }) {
  const [datos, setDatos] = useState([])
  const [tiposDisponibles, setTiposDisponibles] = useState([])
  const [busqueda, setBusqueda] = useState('')
  
  // Estados para el nuevo formulario integrado
  const [modoCreacion, setModoCreacion] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoTipoId, setNuevoTipoId] = useState('')

  const titulos = {
    tipos: 'Gestor de Tipos',
    categorias: 'Gestor de Prendas Específicas',
    etiquetas: 'Gestor de Etiquetas'
  }

  async function cargarDatos() {
    let query = supabase.from(seccion).select('*').order('nombre')
    if (seccion === 'categorias') query = supabase.from('categorias').select('*, tipos(nombre)').order('nombre')
    
    const { data } = await query
    if (data) setDatos(data)
  }

  useEffect(() => {
    cargarDatos()
    setModoCreacion(false) // Reiniciar formulario al cambiar de pestaña
    if (seccion === 'categorias') {
      supabase.from('tipos').select('*').then(({data}) => setTiposDisponibles(data || []))
    }
  }, [seccion])

  async function procesarCreacion(e) {
    e.preventDefault()
    let payload = { nombre: nuevoNombre.trim() }
    
    if (seccion === 'categorias') {
      if (!nuevoTipoId) return alert('Debes seleccionar un Tipo de Prenda.')
      payload.tipo_id = nuevoTipoId
    }

    const { error } = await supabase.from(seccion).insert([payload])
    if (error) {
      alert('Error SQL: ' + error.message)
    } else {
      setNuevoNombre('')
      setNuevoTipoId('')
      setModoCreacion(false)
      cargarDatos()
      if (onCambio) onCambio()
    }
  }

  async function manejarBorrado(id) {
    if (!confirm('¿Eliminar definitivamente? Esto puede borrar datos asociados en cascada.')) return
    const { error } = await supabase.from(seccion).delete().eq('id', id)
    if (error) alert('Error SQL: ' + error.message)
    else {
      cargarDatos()
      if (onCambio) onCambio()
    }
  }

  const datosFiltrados = datos.filter(d => d.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-bold border-b pb-2">{titulos[seccion]}</h2>
      
      <div className="flex gap-4">
        <input 
          type="text" 
          placeholder="Buscar por nombre..." 
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1 p-3 border rounded text-sm outline-none focus:ring-2 focus:ring-black"
        />
        <button 
          onClick={() => setModoCreacion(!modoCreacion)} 
          className="bg-black text-white px-4 py-2 rounded font-bold hover:bg-gray-800 cursor-pointer"
        >
          {modoCreacion ? 'Cancelar' : '+ Crear Nuevo'}
        </button>
      </div>

      {modoCreacion && (
        <form onSubmit={procesarCreacion} className="bg-gray-100 p-4 rounded border flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold mb-1">Nombre</label>
            <input type="text" required value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} className="w-full p-2 border rounded bg-white text-sm" />
          </div>
          {seccion === 'categorias' && (
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold mb-1">Pertenece al Tipo</label>
              <select required value={nuevoTipoId} onChange={e => setNuevoTipoId(e.target.value)} className="w-full p-2 border rounded bg-white text-sm cursor-pointer">
                <option value="">Seleccionar tipo...</option>
                {tiposDisponibles.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
          )}
          <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 cursor-pointer w-full md:w-auto h-fit text-sm">
            Guardar
          </button>
        </form>
      )}

      <div className="overflow-y-auto max-h-[400px]">
        <table className="w-full text-left bg-white border">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="p-3 border-b text-sm">Nombre</th>
              {seccion === 'categorias' && <th className="p-3 border-b text-sm">Pertenece al Tipo</th>}
              <th className="p-3 border-b text-right text-sm">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {datosFiltrados.map(item => (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium text-sm">{item.nombre}</td>
                {seccion === 'categorias' && <td className="p-3 text-gray-500 text-sm">{item.tipos?.nombre}</td>}
                <td className="p-3 text-right">
                  <button onClick={() => manejarBorrado(item.id)} className="text-red-600 font-bold text-xs cursor-pointer hover:underline border border-red-200 px-2 py-1 rounded bg-red-50">Borrar</button>
                </td>
              </tr>
            ))}
            {datosFiltrados.length === 0 && (
              <tr><td colSpan="3" className="p-4 text-center text-gray-500">No hay registros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}