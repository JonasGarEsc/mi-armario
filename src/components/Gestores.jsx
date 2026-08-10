import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Gestores({ seccion, onCambio }) {
  const [items, setItems] = useState([])
  const [tipos, setTipos] = useState([])
  const [nombre, setNombre] = useState('')
  const [tipoRelacionado, setTipoRelacionado] = useState('')

  useEffect(() => {
    cargarDatos()
  }, [seccion])

  async function cargarDatos() {
    if (seccion === 'tipos') {
      const { data } = await supabase.from('tipos').select('*').order('nombre')
      if (data) setItems(data)
    } else {
      const { data: dataCat } = await supabase.from('categorias').select('*, tipos(nombre)').order('nombre')
      if (dataCat) setItems(dataCat)
      const { data: dataTipos } = await supabase.from('tipos').select('*').order('nombre')
      if (dataTipos) setTipos(dataTipos)
    }
  }

  async function crearItem(e) {
    e.preventDefault()
    const nom = nombre.trim()
    if (!nom) return

    if (seccion === 'tipos') {
      await supabase.from('tipos').insert([{ nombre: nom }])
    } else {
      if (!tipoRelacionado) return alert("Selecciona un tipo base.")
      await supabase.from('categorias').insert([{ nombre: nom, tipo_id: tipoRelacionado }])
    }
    
    setNombre('')
    setTipoRelacionado('')
    cargarDatos()
    if (onCambio) onCambio()
  }

  async function eliminarItem(id) {
    const confirmacion = window.confirm(`¿Seguro que quieres eliminar este ${seccion === 'tipos' ? 'Tipo' : 'Prenda específica'}?`)
    if (!confirmacion) return

    const { error } = await supabase.from(seccion).delete().eq('id', id)
    if (error) alert("No se puede eliminar porque está en uso por alguna ropa de tu armario.")
    else {
      cargarDatos()
      if (onCambio) onCambio()
    }
  }

  return (
    <div className="flex flex-col gap-5 text-left pb-4">
      <h2 className="text-2xl font-bold tracking-tight mb-2">Gestionar {seccion === 'tipos' ? 'Tipos' : 'Prendas Específicas'}</h2>
      
      <form onSubmit={crearItem} className="flex gap-2">
        <input 
          type="text" 
          value={nombre} 
          onChange={(e) => setNombre(e.target.value)} 
          placeholder={`Nuevo ${seccion === 'tipos' ? 'tipo...' : 'nombre...'}`} 
          required 
          className="flex-1 p-3 rounded-xl bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-700 outline-none transition-colors text-sm"
        />
        {seccion === 'categorias' && (
          <select value={tipoRelacionado} onChange={(e) => setTipoRelacionado(e.target.value)} required className="w-1/3 p-3 rounded-xl bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 border border-transparent outline-none text-sm">
            <option value="">Tipo base...</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        )}
        <button type="submit" className="bg-black in-[.modo-oscuro]:bg-white text-white in-[.modo-oscuro]:text-black font-bold px-5 rounded-xl active:scale-95 transition-transform text-sm">Añadir</button>
      </form>

      <ul className="flex flex-col gap-2 mt-4 max-h-[40vh] overflow-y-auto hide-scrollbar">
        {items.length === 0 && <p className="text-sm text-neutral-500 text-center py-4">No hay datos.</p>}
        {items.map(item => (
          <li key={item.id} className="flex justify-between items-center p-4 bg-neutral-50 in-[.modo-oscuro]:bg-neutral-900/50 border border-neutral-200 in-[.modo-oscuro]:border-neutral-800 rounded-xl">
            <div className="flex flex-col">
              <span className="font-semibold text-sm">{item.nombre}</span>
              {seccion === 'categorias' && <span className="text-xs text-neutral-500">{item.tipos?.nombre}</span>}
            </div>
            <button onClick={() => eliminarItem(item.id)} className="w-8 h-8 rounded-full bg-white in-[.modo-oscuro]:bg-neutral-800 text-red-500 font-bold flex items-center justify-center shadow-sm border border-neutral-200 in-[.modo-oscuro]:border-neutral-700 active:scale-90 transition-transform text-sm">✕</button>
          </li>
        ))}
      </ul>
    </div>
  )
}