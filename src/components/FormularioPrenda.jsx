import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function FormularioPrenda({ onExito }) {
  const [tipos, setTipos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [etiquetas, setEtiquetas] = useState([])
  
  const [tipoSeleccionado, setTipoSeleccionado] = useState('')
  const [etiquetasSeleccionadas, setEtiquetasSeleccionadas] = useState([])
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    async function cargarListas() {
      supabase.from('tipos').select('*').then(({data}) => setTipos(data || []))
      supabase.from('categorias').select('*').then(({data}) => setCategorias(data || []))
      supabase.from('etiquetas').select('*').then(({data}) => setEtiquetas(data || []))
    }
    cargarListas()
  }, [])

  const categoriasFiltradas = categorias.filter(c => c.tipo_id === tipoSeleccionado)

  function manejarSeleccionEtiqueta(e) {
    const id = e.target.value
    if (id && !etiquetasSeleccionadas.find(et => et.id === id)) {
      const etiq = etiquetas.find(et => et.id === id)
      setEtiquetasSeleccionadas([...etiquetasSeleccionadas, etiq])
    }
    e.target.value = '' // Resetear selector
  }

  function quitarEtiqueta(id) {
    setEtiquetasSeleccionadas(etiquetasSeleccionadas.filter(et => et.id !== id))
  }

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

      const { data: prendaData, error: errPrenda } = await supabase.from('prendas').insert([{
        nombre,
        imagen_url: publicUrl,
        categoria_id: categoriaId,
        color_principal: form.color.value,
        temporada: form.temporada.value
      }]).select().single()

      if (errPrenda) throw new Error('Error al guardar registro.')

      if (etiquetasSeleccionadas.length > 0) {
        const rel = etiquetasSeleccionadas.map(et => ({ prenda_id: prendaData.id, etiqueta_id: et.id }))
        await supabase.from('prenda_etiqueta').insert(rel)
      }

      form.reset()
      setTipoSeleccionado('')
      setEtiquetasSeleccionadas([])
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
        <label className="block text-sm font-bold">1. Fotografía</label>
        <input type="file" name="imagen" accept="image/*" required className="border w-full p-2" />
      </div>
      <div>
        <label className="block text-sm font-bold">2. Nombre Descriptivo</label>
        <input type="text" name="nombrePrenda" required className="border w-full p-2" />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold">3. Tipo</label>
          <select value={tipoSeleccionado} onChange={(e) => setTipoSeleccionado(e.target.value)} required className="border w-full p-2 bg-white">
            <option value="">Seleccionar...</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold">4. Prenda Específica</label>
          <select name="categoria" required disabled={!tipoSeleccionado} className="border w-full p-2 bg-white">
            <option value="">Seleccionar...</option>
            {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold">5. Color</label>
          <input type="text" name="color" required className="border w-full p-2" />
        </div>
        <div>
          <label className="block text-sm font-bold">6. Temporada</label>
          <select name="temporada" required className="border w-full p-2 bg-white">
            <option value="Todas">Todas</option>
            <option value="Verano">Verano</option>
            <option value="Invierno">Invierno</option>
            <option value="Entretiempo">Entretiempo</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold">7. Etiquetas</label>
        <select onChange={manejarSeleccionEtiqueta} className="border w-full p-2 bg-white mb-2">
          <option value="">Añadir etiqueta existente...</option>
          {etiquetas.map(et => <option key={et.id} value={et.id}>{et.nombre}</option>)}
        </select>
        <div className="flex flex-wrap gap-2">
          {etiquetasSeleccionadas.map(et => (
            <span key={et.id} className="bg-gray-800 text-white text-xs px-2 py-1 rounded flex gap-1">
              {et.nombre}
              <button type="button" onClick={() => quitarEtiqueta(et.id)}>✕</button>
            </span>
          ))}
        </div>
      </div>

      <button type="submit" disabled={cargando} className="bg-black text-white font-bold py-3 w-full mt-2">
        {cargando ? 'Procesando...' : 'Guardar Prenda'}
      </button>
    </form>
  )
}