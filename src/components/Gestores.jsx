import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { vibrar } from '../App'

export default function Gestores({ seccion, onCambio, setDialogoGlobal, mostrarToast }) {
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

  async function eliminarItem(item) {
    vibrar(30)
    
    // Si estamos gestionando la lista de "Tipos" generales
    if (seccion === 'tipos') {
      setDialogoGlobal({
        mensaje: `¿Eliminar el tipo "${item.nombre}"?`,
        esDestructivo: true,
        textoConfirmar: 'Eliminar',
        onConfirm: async () => {
          const { error } = await supabase.from('tipos').delete().eq('id', item.id)
          if (error) mostrarToast("No se puede eliminar, está en uso.", "error")
          else {
            cargarDatos()
            if (onCambio) onCambio()
            mostrarToast("Tipo eliminado", "info")
          }
        }
      })
      return
    }

    // LÓGICA DOBLE CONFIRMACIÓN: Lista de "Prendas" (Categorías específicas)
    const { data: prendasAsociadas } = await supabase.from('prendas').select('id, imagen_url').eq('categoria_id', item.id)
    const cantidad = prendasAsociadas ? prendasAsociadas.length : 0

    setDialogoGlobal({
      mensaje: `Vas a eliminar ${cantidad} artículos que pertenecen a esta prenda (${item.nombre}).`,
      esDestructivo: true,
      textoConfirmar: 'Siguiente',
      onConfirm: () => {
        // Ejecutamos un timeout minúsculo para que el primer modal termine de cerrarse antes de saltar la 2da confirmación
        setTimeout(() => {
          setDialogoGlobal({
            mensaje: `¿Estás segur@ que quieres eliminar la prenda?`,
            esDestructivo: true,
            textoConfirmar: 'Sí, eliminar todo',
            onConfirm: async () => {
              if (cantidad > 0) {
                // 1. Borrar todas las imágenes físicas del servidor Storage
                const archivos = prendasAsociadas.map(p => p.imagen_url.split('/').pop())
                if (archivos.length > 0) {
                  await supabase.storage.from('prendas').remove(archivos)
                }
                
                // 2. Borrar las relaciones en la base de datos (Conjuntos y la ropa en sí)
                const idsPrendas = prendasAsociadas.map(p => p.id)
                await supabase.from('conjunto_prenda').delete().in('prenda_id', idsPrendas)
                await supabase.from('prendas').delete().in('id', idsPrendas)
              }
              
              // 3. Finalmente borrar la categoría (Prenda) de la lista de gestión
              const { error } = await supabase.from('categorias').delete().eq('id', item.id)
              
              if (error) {
                mostrarToast("Error al eliminar", "error")
              } else {
                cargarDatos()
                if (onCambio) onCambio()
                mostrarToast("Prenda y artículos eliminados", "exito")
                vibrar([50, 50])
              }
            }
          })
        }, 300)
      }
    })
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
          className="flex-1 p-3 rounded-xl bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-700 outline-none transition-colors text-sm touch-manipulation"
        />
        {seccion === 'categorias' && (
          <select value={tipoRelacionado} onChange={(e) => setTipoRelacionado(e.target.value)} required className="w-1/3 p-3 rounded-xl bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 border border-transparent outline-none text-sm touch-manipulation">
            <option value="">Tipo base...</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        )}
        <button type="submit" className="bg-black in-[.modo-oscuro]:bg-white text-white in-[.modo-oscuro]:text-black font-bold px-5 rounded-xl active:scale-95 transition-transform text-sm touch-manipulation">Añadir</button>
      </form>

      <ul className="flex flex-col gap-2 mt-4 max-h-[40vh] overflow-y-auto hide-scrollbar">
        {items.length === 0 && <p className="text-sm text-neutral-500 text-center py-4">No hay datos.</p>}
        {items.map(item => (
          <li key={item.id} className="flex justify-between items-center p-4 bg-neutral-50 in-[.modo-oscuro]:bg-neutral-900/50 border border-neutral-200 in-[.modo-oscuro]:border-neutral-800 rounded-xl">
            <div className="flex flex-col">
              <span className="font-semibold text-sm">{item.nombre}</span>
              {seccion === 'categorias' && <span className="text-xs text-neutral-500">{item.tipos?.nombre}</span>}
            </div>
            <button onClick={() => eliminarItem(item)} className="w-8 h-8 rounded-full bg-white in-[.modo-oscuro]:bg-neutral-800 text-red-500 font-bold flex items-center justify-center shadow-sm border border-neutral-200 in-[.modo-oscuro]:border-neutral-700 active:scale-90 transition-transform text-sm touch-manipulation">✕</button>
          </li>
        ))}
      </ul>
    </div>
  )
}