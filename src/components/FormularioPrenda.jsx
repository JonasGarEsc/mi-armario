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
      setEstadoProceso('Comprimiendo imagen…')

      // 900 px sobra: la rejilla pinta a 150 y el lienzo del outfit a 130.
      // useWebWorker en false evita cuelgues en Safari iOS al comprimir.
      const opcionesCompresion = { maxSizeMB: 0.25, maxWidthOrHeight: 900, useWebWorker: false, fileType: 'image/webp' }
      let archivoProcesado = await imageCompression(archivoOriginal, opcionesCompresion)

      if (quitarFondo) {
        setEstadoProceso('Recortando fondo (IA)…')
        // Sin publicPath: la librería usa el CDN de su propia versión (1.7.0).
        // Fijarlo a 1.4.5 descuadraba los modelos con la librería instalada.
        const blobSinFondo = await removeBackground(archivoProcesado)
        const recorte = new File([blobSinFondo], 'recorte.png', { type: 'image/png' })
        setEstadoProceso('Comprimiendo recorte…')
        // El recorte sale en PNG a tamaño completo (400 kB por prenda): se reencodea a WebP.
        try {
          archivoProcesado = await imageCompression(recorte, opcionesCompresion)
        } catch {
          archivoProcesado = recorte
        }
      }

      const extension = archivoProcesado.type === 'image/png' ? 'png' : 'webp'
      const nombreArchivo = `prenda-${Date.now()}.${extension}`

      setEstadoProceso('Subiendo al servidor…')
      const { error: errImg } = await supabase.storage.from('prendas').upload(nombreArchivo, archivoProcesado)
      if (errImg) throw new Error('Error al subir imagen. Revisa tu conexión.')

      const { data: { publicUrl } } = supabase.storage.from('prendas').getPublicUrl(nombreArchivo)

      setEstadoProceso('Guardando en base de datos…')
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
      <h2 className="font-display text-3xl md:text-4xl mb-1">Añadir prenda</h2>

      {errorFormulario && (
        <div className="p-4 border-l-2 border-red-700 bg-red-700/5 text-red-800 in-[.modo-oscuro]:text-red-300">
          <span className="text-sm">{errorFormulario}</span>
        </div>
      )}

      <div>
        <label htmlFor="imagen" className="block text-[13px] mb-2 text-tenue">Fotografía</label>
        <input id="imagen" type="file" name="imagen" accept="image/*" required className="campo p-0 text-sm file:mr-4 file:py-2.5 file:px-4 file:border-0 file:bg-tinta file:text-papel file:text-xs file:cursor-pointer touch-manipulation" />
      </div>

      <div className="flex items-center gap-3">
        <input type="checkbox" id="toggleFondo" checked={quitarFondo} onChange={(e) => setQuitarFondo(e.target.checked)} className="w-4 h-4 accent-acento cursor-pointer touch-manipulation" />
        <label htmlFor="toggleFondo" className="text-sm text-tinta cursor-pointer select-none">Quitar el fondo automáticamente</label>
      </div>

      <div>
        <label htmlFor="nombrePrenda" className="block text-[13px] mb-2 text-tenue">Nombre</label>
        <input id="nombrePrenda" type="text" name="nombrePrenda" autoComplete="off" required placeholder="Cazadora de cuero negra" className="campo touch-manipulation" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="tipoPrenda" className="block text-[13px] mb-2 text-tenue">Tipo</label>
          <select id="tipoPrenda" value={tipoSeleccionado} onChange={(e) => setTipoSeleccionado(e.target.value)} required className="campo touch-manipulation">
            <option value="">Elegir…</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="categoria" className="block text-[13px] mb-2 text-tenue">Categoría</label>
          <select id="categoria" name="categoria" required disabled={!tipoSeleccionado} className="campo disabled:opacity-50 touch-manipulation">
            <option value="">Elegir…</option>
            {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      <button type="submit" disabled={cargando} className="mt-3 flex items-center justify-center gap-3 bg-tinta text-papel py-3.5 w-full active:opacity-80 transition-opacity disabled:opacity-70 touch-manipulation">
        {cargando && <div className="w-4 h-4 border border-papel/40 border-t-papel rounded-full animate-spin"></div>}
        {cargando ? estadoProceso : 'Guardar prenda'}
      </button>
    </form>
  )
}
