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
  
  // Nuevo estado para errores limpios sin alert()
  const [errorFormulario, setErrorFormulario] = useState('')

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
    setErrorFormulario('') // Limpiamos errores previos

    const form = e.target
    const archivoOriginal = form.imagen.files[0]
    const nombre = form.nombrePrenda.value.trim()
    const categoriaId = form.categoria.value

    if (!archivoOriginal || !nombre || !categoriaId) {
      setErrorFormulario('Faltan datos obligatorios.')
      setCargando(false)
      return
    }

    try {
      setEstadoProceso('Comprimiendo imagen...')
      
      // FIX 1: useWebWorker en false evita cuelgues en Safari iOS al comprimir
      const opcionesCompresion = { maxSizeMB: 0.3, maxWidthOrHeight: 1080, useWebWorker: false, fileType: 'image/webp' }
      let archivoProcesado = await imageCompression(archivoOriginal, opcionesCompresion)

      if (quitarFondo) {
        setEstadoProceso('Recortando fondo (IA)...')
        
        // FIX 2: Obligamos a la librería a usar el CDN seguro oficial, saltándose el bloqueo de iOS
        const configuracionIA = {
          publicPath: "https://static.imgly.com/@imgly/background-removal-data/1.4.5/dist/"
        }
        
        const blobSinFondo = await removeBackground(archivoProcesado, configuracionIA)
        archivoProcesado = new File([blobSinFondo], `recorte-${Date.now()}.png`, { type: 'image/png' })
      }

      const nombreArchivo = `prenda-${Date.now()}.${quitarFondo ? 'png' : 'webp'}`

      setEstadoProceso('Subiendo al servidor...')
      const { error: errImg } = await supabase.storage.from('prendas').upload(nombreArchivo, archivoProcesado)
      if (errImg) throw new Error('Error al subir imagen. Revisa tu conexión.')
      
      const { data: { publicUrl } } = supabase.storage.from('prendas').getPublicUrl(nombreArchivo)

      setEstadoProceso('Guardando en base de datos...')
      const { error: errPrenda } = await supabase.from('prendas').insert([{ nombre, imagen_url: publicUrl, categoria_id: categoriaId }])

      if (errPrenda) throw new Error('Error en base de datos al guardar la ropa.')

      form.reset()
      setTipoSeleccionado('')
      setQuitarFondo(false)
      if (onExito) onExito()

    } catch (error) {
      console.error(error)
      setErrorFormulario(error.message || 'Fallo desconocido al procesar la imagen.')
    } finally {
      setCargando(false)
      setEstadoProceso('')
    }
  }

  return (
    <form onSubmit={manejarEnvio} className="flex flex-col gap-5 text-left pb-4">
      <h2 className="text-2xl font-bold tracking-tight mb-2">Añadir Prenda</h2>
      
      {/* Caja de error profesional */}
      {errorFormulario && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-100 in-[.modo-oscuro]:bg-red-900/30 border border-red-200 in-[.modo-oscuro]:border-red-800 text-red-700 in-[.modo-oscuro]:text-red-400">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <span className="text-sm font-semibold">{errorFormulario}</span>
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold mb-2 text-neutral-700 in-[.modo-oscuro]:text-neutral-300">Fotografía</label>
        <input type="file" name="imagen" accept="image/*" required className="w-full p-3 rounded-xl bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-700 outline-none transition-colors text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-black file:text-white in-[.modo-oscuro]:file:bg-white in-[.modo-oscuro]:file:text-black hover:file:bg-neutral-800 touch-manipulation" />
      </div>

      <div className="flex items-center gap-3 p-4 rounded-xl bg-neutral-50 in-[.modo-oscuro]:bg-neutral-900/50 border border-neutral-200 in-[.modo-oscuro]:border-neutral-800">
        <input type="checkbox" id="toggleFondo" checked={quitarFondo} onChange={(e) => setQuitarFondo(e.target.checked)} className="w-5 h-5 accent-black in-[.modo-oscuro]:accent-white cursor-pointer touch-manipulation" />
        <label htmlFor="toggleFondo" className="text-sm font-semibold text-neutral-700 in-[.modo-oscuro]:text-neutral-300 cursor-pointer select-none">✨ Recorte mágico (IA)</label>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-neutral-700 in-[.modo-oscuro]:text-neutral-300">Nombre descriptivo</label>
        <input type="text" name="nombrePrenda" autoComplete="off" required placeholder="Ej. Cazadora cuero negra" className="w-full p-4 rounded-xl bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-700 outline-none transition-colors text-sm touch-manipulation" />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2 text-neutral-700 in-[.modo-oscuro]:text-neutral-300">Tipo</label>
          <select value={tipoSeleccionado} onChange={(e) => setTipoSeleccionado(e.target.value)} required className="w-full p-4 rounded-xl bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-700 outline-none transition-colors text-sm touch-manipulation">
            <option value="">Seleccionar...</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2 text-neutral-700 in-[.modo-oscuro]:text-neutral-300">Prenda Específica</label>
          <select name="categoria" required disabled={!tipoSeleccionado} className="w-full p-4 rounded-xl bg-neutral-100 in-[.modo-oscuro]:bg-neutral-900 border border-transparent focus:border-neutral-300 in-[.modo-oscuro]:focus:border-neutral-700 outline-none transition-colors disabled:opacity-50 text-sm touch-manipulation">
            <option value="">Seleccionar...</option>
            {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      <button type="submit" disabled={cargando} className="mt-4 flex items-center justify-center gap-3 bg-black in-[.modo-oscuro]:bg-white text-white in-[.modo-oscuro]:text-black font-bold py-4 w-full rounded-xl active:scale-[0.98] transition-transform disabled:opacity-70 touch-manipulation">
        {cargando && <div className="w-5 h-5 border-2 border-neutral-500 border-t-transparent in-[.modo-oscuro]:border-neutral-300 in-[.modo-oscuro]:border-t-transparent rounded-full animate-spin"></div>}
        {cargando ? estadoProceso : 'Guardar Prenda'}
      </button>
    </form>
  )
}