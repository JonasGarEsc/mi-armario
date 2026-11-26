import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { vibrar } from '../lib/vibrar'
import { borrarArchivo } from '../lib/imagenes'
import Icono from './Icono'

export default function Gestores({ seccion, onCambio, setDialogoGlobal, mostrarToast }) {
  const [items, setItems] = useState([])
  const [tipos, setTipos] = useState([])
  const [nombre, setNombre] = useState('')
  const [tipoRelacionado, setTipoRelacionado] = useState('')

  const cargarDatos = useCallback(async () => {
    if (seccion === 'tipos') {
      const { data } = await supabase.from('tipos').select('*').order('nombre')
      if (data) setItems(data)
    } else {
      const { data: dataCat } = await supabase.from('categorias').select('*, tipos(nombre)').order('nombre')
      if (dataCat) setItems(dataCat)
      const { data: dataTipos } = await supabase.from('tipos').select('*').order('nombre')
      if (dataTipos) setTipos(dataTipos)
    }
  }, [seccion])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  async function crearItem(e) {
    e.preventDefault()
    const nom = nombre.trim()
    if (!nom) return

    if (seccion === 'tipos') {
      const { error } = await supabase.from('tipos').insert([{ nombre: nom }])
      if (error) return mostrarToast('No se pudo crear el tipo', 'error')
    } else {
      if (!tipoRelacionado) return mostrarToast("Selecciona un tipo base.", "error")
      const { error } = await supabase.from('categorias').insert([{ nombre: nom, tipo_id: tipoRelacionado }])
      if (error) return mostrarToast('No se pudo crear la categoría', 'error')
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
          if (error) mostrarToast("No se puede eliminar: tiene categorías o prendas dentro.", "error")
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
              const idsPrendas = (prendasAsociadas || []).map(p => p.id)
              const urls = (prendasAsociadas || []).map(p => p.imagen_url)

              // Primero la base de datos: la cascada borra sus outfits, usos y maleta.
              if (idsPrendas.length > 0) {
                const { error: errPrendas } = await supabase.from('prendas').delete().in('id', idsPrendas)
                if (errPrendas) return mostrarToast("No se pudieron eliminar los artículos", "error")
              }
              
              // Después la categoría (Prenda) y, solo si eso fue bien, los archivos.
              const { error } = await supabase.from('categorias').delete().eq('id', item.id)

              if (!error && urls.length > 0) {
                for (const url of urls) await borrarArchivo(url)
              }
              
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
    <div className="flex flex-col gap-4 text-left">
      <h2 className="titulo-hoja">Gestionar {seccion === 'tipos' ? 'Tipos' : 'Prendas Específicas'}</h2>

      <form onSubmit={crearItem} className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={`Nuevo ${seccion === 'tipos' ? 'tipo...' : 'nombre...'}`}
            aria-label={seccion === 'tipos' ? 'Nuevo tipo' : 'Nuevo nombre'}
            required
            className="campo flex-1 min-w-0"
          />
          <button type="submit" className="boton boton-primario">Añadir</button>
        </div>
        {seccion === 'categorias' && (
          <select value={tipoRelacionado} onChange={(e) => setTipoRelacionado(e.target.value)} aria-label="Tipo base" required className="campo">
            <option value="">Tipo base...</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        )}
      </form>

      <ul className="divide-y divide-linea">
        {items.length === 0 && <li className="text-tenue text-center py-4">No hay datos.</li>}
        {items.map(item => (
          <li key={item.id} className="flex justify-between items-center gap-3 min-h-14 py-1">
            <div className="flex flex-col min-w-0">
              <span className="font-semibold truncate">{item.nombre}</span>
              {seccion === 'categorias' && <span className="text-sm text-tenue truncate">{item.tipos?.nombre}</span>}
            </div>
            <button onClick={() => eliminarItem(item)} aria-label={`Eliminar ${item.nombre}`} className="boton-icono -mr-2 text-peligro">
              <Icono nombre="borrar" className="w-5 h-5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}