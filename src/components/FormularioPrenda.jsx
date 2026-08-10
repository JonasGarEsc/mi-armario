import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import imageCompression from 'browser-image-compression'
import { removeBackground } from '@imgly/background-removal'

export default function FormularioPrenda({ onExito }) {
  const [tipos, setTipos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [tipoSeleccionado, setTipoSeleccionado] = useState('')
  const [cargando, setCargando] = useState(false)
  const [estadoProceso, setEstadoProceso] = useState('')
  const [quitarFondo, setQuitarFondo] = useState(false)

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
    const archivoOriginal = form.imagen.files[0]
    const nombre = form.nombrePrenda.value.trim()
    const categoriaId = form.categoria.value

    if (!archivoOriginal || !nombre || !categoriaId) {
      alert('Faltan datos obligatorios.')
      setCargando(false)
      return
    }

    try {
      setEstadoProceso('Comprimiendo imagen...')
      
      const opcionesCompresion = { maxSizeMB: 0.3, maxWidthOrHeight: 1080, useWebWorker: true, fileType: 'image/webp' }
      let archivoProcesado = await imageCompression(archivoOriginal, opcionesCompresion)

      if (quitarFondo) {
        setEstadoProceso('Recortando fondo (IA)...')
        const blobSinFondo = await removeBackground(archivoProcesado)
        archivoProcesado = new File([blobSinFondo], `recorte-${Date.now()}.png`, { type: 'image/png' })
      }

      const nombreArchivo = `prenda-${Date.now()}.${quitarFondo ? 'png' : 'webp'}`

      setEstadoProceso('Subiendo...')
      const { error: errImg } = await supabase.storage.from('prendas').upload(nombreArchivo, archivoProcesado)
      if (errImg) throw new Error('Error al subir imagen.')
      
      const { data: { publicUrl } } = supabase.storage.from('prendas').getPublicUrl(nombreArchivo)

      setEstadoProceso('Guardando...')
      const { error: errPrenda } = await supabase.from('prendas').insert([{ nombre, imagen_url: publicUrl, categoria_id: categoriaId }])

      if (errPrenda) throw new Error('Error en base de datos.')

      form.reset()
      setTipoSeleccionado('')
      setQuitarFondo(false)
      if (onExito) onExito()

    } catch (error) {
      alert(error.message)
    } finally {
      setCargando(false)
      setEstadoProceso('')
    }
  }

  return (
    <form onSubmit={manejarEnvio} className="flex flex-col gap-5 text-left pb-4">
      <h2 className="text-2xl font-bold tracking-tight mb-2">Añadir Prenda</h2>
      
      <div>
        <label className="block text-sm font-semibold mb-2 text-neutral-700 in-[.modo-oscuro]:text-neutral-300">Fotografía</label>
        <input type="file" name="imagen" accept="image/*" required className="w-full p-3 rounded-xl bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-700 outline-none transition-colors text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-black file:text-white in-[.modo-oscuro]:file:bg-white in-[.modo-oscuro]:file:text-black hover:file:bg-neutral-800" />
      </div>

      <div className="flex items-center gap-3 p-4 rounded-xl bg-neutral-50 in-[.modo-oscuro]:bg-neutral-900/50 border border-neutral-200 in-[.modo-oscuro]:border-neutral-800">
        <input type="checkbox" id="toggleFondo" checked={quitarFondo} onChange={(e) => setQuitarFondo(e.target.checked)} className="w-5 h-5 accent-black in-[.modo-oscuro]:accent-white cursor-pointer" />
        <label htmlFor="toggleFondo" className="text-sm font-semibold text-neutral-700 in-[.modo-oscuro]:text-neutral-300 cursor-pointer select-none">✨ Recorte mágico (IA)</label>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-neutral-700 in-[.modo-oscuro]:text-neutral-300">Nombre descriptivo</label>
        <input type="text" name="nombrePrenda" autoComplete="off" required placeholder="Ej. Cazadora cuero negra" className="w-full p-4 rounded-xl bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-700 outline-none transition-colors text-sm" />
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
          <select name="categoria" required disabled={!tipoSeleccionado} className="w-full p-4 rounded-xl bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-700 outline-none transition-colors disabled:opacity-50 text-sm">
            <option value="">Seleccionar...</option>
            {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      <button type="submit" disabled={cargando} className="mt-4 flex items-center justify-center gap-3 bg-black in-[.modo-oscuro]:bg-white text-white in-[.modo-oscuro]:text-black font-bold py-4 w-full rounded-xl active:scale-[0.98] transition-transform disabled:opacity-70">
        {cargando && <div className="w-5 h-5 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin"></div>}
        {cargando ? estadoProceso : 'Guardar Prenda'}
      </button>
    </form>
  )
}