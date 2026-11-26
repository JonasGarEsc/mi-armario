import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { borrarArchivo } from '../lib/imagenes'
import { prepararFoto, subirFoto } from '../lib/imagen'

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
      const archivoProcesado = await prepararFoto(archivoOriginal, {
        quitarFondo,
        onEstado: setEstadoProceso,
      })
      const subida = await subirFoto(archivoProcesado, { onEstado: setEstadoProceso })

      setEstadoProceso('Guardando en base de datos…')
      const { error: errPrenda } = await supabase.from('prendas').insert([{ nombre, imagen_url: subida.url, categoria_id: categoriaId }])

      if (errPrenda) {
        // Si la fila falla, la foto no se queda huérfana en el bucket.
        await borrarArchivo(subida.url)
        throw new Error('Error en base de datos al guardar la ropa.')
      }

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
      <p className="text-sm text-tenue -mt-2">La primera vez descarga el modelo de recorte (~24 MB; unos 6 MB comprimidos).</p>

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

      {tipos.length === 0 && (
        <p className="text-sm text-tenue">Aún no tienes tipos ni categorías: créalos en Ajustes → Tipos y Categorías.</p>
      )}

      <button type="submit" disabled={cargando} className="boton boton-primario mt-2 w-full">
        {cargando && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
        {cargando ? estadoProceso : 'Guardar prenda'}
      </button>
    </form>
  )
}
