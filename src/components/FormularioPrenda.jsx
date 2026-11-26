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
    <form onSubmit={manejarEnvio} className="flex flex-col gap-4 text-left">
      <h2 className="titulo-hoja">Añadir prenda</h2>

      {errorFormulario && (
        <div role="alert" className="aviso-error">{errorFormulario}</div>
      )}

      <div>
        <label htmlFor="imagen" className="etiqueta">Fotografía</label>
        <input id="imagen" type="file" name="imagen" accept="image/*" required className="campo p-1.5! text-tenue file:mr-3 file:min-h-9 file:px-3 file:border-0 file:rounded-lg file:bg-lamina file:text-tinta file:font-semibold file:cursor-pointer" />
      </div>

      <div className="flex items-center gap-3 min-h-11">
        <input type="checkbox" id="toggleFondo" checked={quitarFondo} onChange={(e) => setQuitarFondo(e.target.checked)} className="w-6 h-6 shrink-0 accent-acento cursor-pointer" />
        <label htmlFor="toggleFondo" className="flex-1 py-2.5 cursor-pointer select-none">Quitar el fondo automáticamente</label>
      </div>

      <div>
        <label htmlFor="nombrePrenda" className="etiqueta">Nombre</label>
        <input id="nombrePrenda" type="text" name="nombrePrenda" autoComplete="off" required placeholder="Cazadora de cuero negra" className="campo" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="tipoPrenda" className="etiqueta">Tipo</label>
          <select id="tipoPrenda" value={tipoSeleccionado} onChange={(e) => setTipoSeleccionado(e.target.value)} required className="campo">
            <option value="">Elegir…</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="categoria" className="etiqueta">Categoría</label>
          <select id="categoria" name="categoria" required disabled={!tipoSeleccionado} className="campo disabled:opacity-50">
            <option value="">Elegir…</option>
            {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      <button type="submit" disabled={cargando} className="boton boton-primario mt-2 w-full">
        {cargando && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
        {cargando ? estadoProceso : 'Guardar prenda'}
      </button>
    </form>
  )
}
