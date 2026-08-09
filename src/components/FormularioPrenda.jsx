import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function FormularioPrenda({ onExito }) {
  const [tipos, setTipos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [tipoSeleccionado, setTipoSeleccionado] = useState('')
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    async function cargarListas() {
      supabase.from('tipos').select('*').then(({data}) => setTipos(data || []))
      supabase.from('categorias').select('*').then(({data}) => setCategorias(data || []))
    }
    cargarListas()
  }, [])

  const categoriasFiltradas = categorias.filter(c => c.tipo_id === tipoSeleccionado)

  async function manejarEnvio(e) {
    e.preventDefault()
    setCargando(true)

    const form = e.target
    const archivo = form.imagen.files[0]
    const nombre = form.nombrePrenda.value.trim()
    const categoriaId = form.categoria.value

    if (!archivo || !nombre || !categoriaId) {
      alert('Faltan datos obligatorios.')
      setCargando(false)
      return
    }

    try {
      const nombreArchivo = `${Date.now()}-${archivo.name}`
      const { error: errImg } = await supabase.storage.from('prendas').upload(nombreArchivo, archivo)
      if (errImg) throw new Error('Error al subir imagen.')
      
      const { data: { publicUrl } } = supabase.storage.from('prendas').getPublicUrl(nombreArchivo)

      const { error: errPrenda } = await supabase.from('prendas').insert([{
        nombre,
        imagen_url: publicUrl,
        categoria_id: categoriaId
      }])

      if (errPrenda) throw new Error('Error al guardar registro en la base de datos.')

      form.reset()
      setTipoSeleccionado('')
      if (onExito) onExito()

    } catch (error) {
      alert(error.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <form onSubmit={manejarEnvio} className="flex flex-col gap-4 text-left">
      <div>
        <label className="block text-sm font-bold text-slate-700 in-[.modo-oscuro_&]:text-slate-200">1. Fotografía</label>
        <input type="file" name="imagen" accept="image/*" required className="border border-rose-200 in-[.modo-oscuro_&]:border-slate-700 w-full p-2 rounded-xl bg-white in-[.modo-oscuro_&]:bg-slate-700 cursor-pointer shadow-sm" />
      </div>
      <div>
        <label className="block text-sm font-bold text-slate-700 in-[.modo-oscuro_&]:text-slate-200">2. Nombre Descriptivo (Ej. Pantalón negro cuero)</label>
        <input type="text" name="nombrePrenda" required className="border border-rose-200 in-[.modo-oscuro_&]:border-slate-700 w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-teal-400 bg-white in-[.modo-oscuro_&]:bg-slate-700 text-slate-800 in-[.modo-oscuro_&]:text-slate-100 shadow-sm" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 in-[.modo-oscuro_&]:text-slate-200">3. Tipo</label>
          <select value={tipoSeleccionado} onChange={(e) => setTipoSeleccionado(e.target.value)} required className="border border-rose-200 in-[.modo-oscuro_&]:border-slate-700 w-full p-3 rounded-xl bg-white in-[.modo-oscuro_&]:bg-slate-700 text-slate-800 in-[.modo-oscuro_&]:text-slate-100 cursor-pointer shadow-sm outline-none focus:ring-2 focus:ring-teal-400">
            <option value="">Seleccionar...</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 in-[.modo-oscuro_&]:text-slate-200">4. Prenda Específica</label>
          <select name="categoria" required disabled={!tipoSeleccionado} className="border border-rose-200 in-[.modo-oscuro_&]:border-slate-700 w-full p-3 rounded-xl bg-white in-[.modo-oscuro_&]:bg-slate-700 text-slate-800 in-[.modo-oscuro_&]:text-slate-100 cursor-pointer shadow-sm outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-50">
            <option value="">Seleccionar...</option>
            {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>
      <button type="submit" disabled={cargando} className="bg-teal-400 in-[.modo-oscuro_&]:bg-indigo-500 text-slate-900 in-[.modo-oscuro_&]:text-white font-bold py-3 w-full mt-4 rounded-xl cursor-pointer hover:bg-teal-500 in-[.modo-oscuro_&]:hover:bg-indigo-400 shadow-lg active:scale-95 transition-transform">
        {cargando ? 'Procesando...' : 'Guardar Prenda'}
      </button>
    </form>
  )
}