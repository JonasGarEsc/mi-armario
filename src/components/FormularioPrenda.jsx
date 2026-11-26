import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { borrarArchivo } from '../lib/imagenes'
import { prepararFoto, subirFoto } from '../lib/imagen'
import { colorDeImagen } from '../lib/colores'
import { traerDatosDeEnlace } from '../lib/enlace'
import {
  clasificarSugerencia, etiquetasDeFormulario, etiquetasParaGuardar, hayEtiquetas, insertarPrenda, origenEtiquetas, pedirEtiquetas,
} from '../lib/etiquetas'
import CamposEtiquetas from './CamposEtiquetas'

export default function FormularioPrenda({ onExito, onVarias, deseo = false }) {
  const [tipos, setTipos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [archivo, setArchivo] = useState(null)
  const [nombre, setNombre] = useState('')
  const [tipoSeleccionado, setTipoSeleccionado] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [etiquetas, setEtiquetas] = useState(() => etiquetasDeFormulario(null))
  const [cargando, setCargando] = useState(false)
  const [estadoProceso, setEstadoProceso] = useState('')
  const [quitarFondo, setQuitarFondo] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const [sugeridaPorIA, setSugeridaPorIA] = useState(false)
  const [pista, setPista] = useState('')
  const [errorFormulario, setErrorFormulario] = useState('')
  const [enlace, setEnlace] = useState('')
  const [trayendoEnlace, setTrayendoEnlace] = useState(false)
  const [avisoEnlace, setAvisoEnlace] = useState('')

  // La foto se prepara (comprime, recorta) en cuanto se elige, mientras rellenas el resto.
  const tarea = useRef(null)
  // Lo que ya has tocado a mano no lo pisan las sugerencias.
  const tocado = useRef({ nombre: false, clasificacion: false, etiquetas: false })
  const listas = useRef({ tipos: [], categorias: [] })
  listas.current = { tipos, categorias }
  // Para rellenar solo huecos con los datos del enlace, sin pisar lo escrito.
  const escritos = useRef({ nombre: '', etiquetas: null, archivo: null })
  escritos.current = { nombre, etiquetas, archivo }

  useEffect(() => {
    supabase.from('tipos').select('*').then(({ data }) => setTipos(data || []))
    supabase.from('categorias').select('*').then(({ data }) => setCategorias(data || []))
  }, [])

  // También se puede pegar una imagen (Ctrl/⌘+V) o traerla del portapapeles con el botón.
  useEffect(() => {
    const alPegar = (e) => {
      const imagen = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'))
      if (imagen) { e.preventDefault(); setArchivo(imagen) }
    }
    document.addEventListener('paste', alPegar)
    return () => document.removeEventListener('paste', alPegar)
  }, [])

  async function pegarImagen() {
    try {
      for (const item of await navigator.clipboard.read()) {
        const tipo = item.types.find((t) => t.startsWith('image/'))
        if (tipo) {
          setArchivo(new File([await item.getType(tipo)], 'imagen-pegada.png', { type: tipo }))
          return
        }
      }
      setErrorFormulario('No hay ninguna imagen en el portapapeles.')
    } catch {
      setErrorFormulario('No se pudo leer el portapapeles. Prueba a pegar con Ctrl/⌘+V.')
    }
  }

  useEffect(() => {
    if (!archivo) {
      tarea.current = null
      return
    }
    let vivo = true
    setAnalizando(true)
    setSugeridaPorIA(false)
    setPista('')

    const preparada = prepararFoto(archivo, { quitarFondo, onEstado: setEstadoProceso })
    tarea.current = preparada

    preparada
      .then(async (foto) => {
        if (!vivo) return
        const [color, sugerencia] = await Promise.all([
          colorDeImagen(foto),
          pedirEtiquetas(supabase, { foto }),
        ])
        if (!vivo) return

        if (!tocado.current.etiquetas) {
          const propuestas = { ...(sugerencia?.etiquetas || {}), ...(color || {}) }
          setEtiquetas(etiquetasDeFormulario(propuestas))
        }
        if (!sugerencia) return
        setSugeridaPorIA(hayEtiquetas(sugerencia.etiquetas) || Boolean(sugerencia.nombre))
        if (!tocado.current.nombre && sugerencia.nombre) setNombre((actual) => actual || sugerencia.nombre)

        // Se clasifica solo con tipos y categorías que ya existen.
        if (tocado.current.clasificacion) return
        const { tipos: ts, categorias: cs } = listas.current
        const c = clasificarSugerencia(sugerencia, ts, cs)
        if (c.tipoId) setTipoSeleccionado(c.tipoId)
        if (c.categoriaId) setCategoriaId(c.categoriaId)
        setPista(c.pista)
      })
      .catch(() => { /* el error se enseña al guardar */ })
      .finally(() => { if (vivo) setAnalizando(false) })

    return () => { vivo = false }
  }, [archivo, quitarFondo])

  const categoriasFiltradas = categorias.filter(c => c.tipo_id === tipoSeleccionado)

  function elegirFoto(e) {
    const nueva = e.target.files?.[0] || null
    // Una foto nueva vuelve a proponer cosas; lo que escribas a mano se respeta.
    setArchivo(nueva)
  }

  async function traerDatos(e) {
    e.preventDefault()
    const url = enlace.trim()
    if (!url) {
      setAvisoEnlace('Pega el enlace de la tienda.')
      return
    }
    setTrayendoEnlace(true)
    setAvisoEnlace('')
    const datos = await traerDatosDeEnlace(supabase, url)
    setTrayendoEnlace(false)
    if (!datos) {
      setAvisoEnlace('No se pudo leer el enlace, rellénalo a mano.')
      return
    }

    // Solo se rellenan los campos vacíos: lo que ya hayas escrito no se toca.
    const actual = escritos.current
    let relleno = false
    if (datos.nombre && !actual.nombre.trim()) {
      setNombre((previo) => (previo.trim() ? previo : datos.nombre))
      relleno = true
    }
    if (datos.precio !== '' && String(actual.etiquetas?.precio ?? '').trim() === '') {
      setEtiquetas((previas) => (String(previas.precio ?? '').trim() ? previas : { ...previas, precio: datos.precio }))
      relleno = true
    }
    if (datos.foto && !actual.archivo) {
      // La foto entra por el mismo flujo que una elegida a mano.
      setArchivo((previa) => previa || datos.foto)
      relleno = true
    }
    setAvisoEnlace(relleno
      ? 'Datos traídos. Revísalos y pulsa «Guardar deseo».'
      : 'No se han encontrado datos nuevos; rellénalo a mano.')
  }

  async function manejarEnvio(e) {
    e.preventDefault()
    setCargando(true)
    setErrorFormulario('')

    const nombreLimpio = nombre.trim()
    if (!archivo || !nombreLimpio || !categoriaId) {
      setErrorFormulario('Faltan datos obligatorios.')
      setCargando(false)
      return
    }

    try {
      const procesada = await tarea.current
      const subida = await subirFoto(procesada, { onEstado: setEstadoProceso })

      setEstadoProceso('Guardando en base de datos…')
      const fila = etiquetasParaGuardar(etiquetas)
      const auto = origenEtiquetas({ sugeridaPorIA, editadas: tocado.current.etiquetas })
      const errPrenda = await insertarPrenda(
        supabase,
        { nombre: nombreLimpio, imagen_url: subida.url, categoria_id: categoriaId, ...(deseo && { deseada: true }) },
        { ...fila, etiquetas_auto: auto },
      )

      if (errPrenda) {
        // Si la fila falla, la foto no se queda huérfana en el bucket.
        await borrarArchivo(subida.url)
        throw new Error(deseo ? 'No se pudo guardar el deseo.' : 'Error en base de datos al guardar la ropa.')
      }

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
      <h2 className="titulo-hoja">{deseo ? 'Añadir a mi lista de deseos' : 'Añadir prenda'}</h2>
      {onVarias && !deseo && (
        <button type="button" onClick={onVarias} className="boton boton-secundario w-full -mt-1">Subir varias fotos a la vez</button>
      )}

      {errorFormulario && (
        <div role="alert" className="aviso-error">{errorFormulario}</div>
      )}

      {deseo && (
        <div>
          <label htmlFor="enlaceTienda" className="etiqueta">Enlace de la tienda</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="enlaceTienda"
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck="false"
              placeholder="https://tienda.example/producto"
              value={enlace}
              onChange={(e) => { setEnlace(e.target.value); setAvisoEnlace('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') traerDatos(e) }}
              className="campo"
            />
            <button type="button" onClick={traerDatos} disabled={trayendoEnlace} className="boton boton-secundario shrink-0">
              {trayendoEnlace ? 'Leyendo…' : 'Traer datos'}
            </button>
          </div>
          {avisoEnlace && <p role="status" className="text-sm text-tenue mt-1">{avisoEnlace}</p>}
        </div>
      )}

      <div>
        <label htmlFor="imagen" className="etiqueta">Fotografía</label>
        <input id="imagen" type="file" name="imagen" accept="image/*" onChange={elegirFoto} className="campo p-1.5! text-tenue file:mr-3 file:min-h-9 file:px-3 file:border-0 file:rounded-lg file:bg-lamina file:text-tinta file:font-semibold file:cursor-pointer" />
      </div>

      {archivo?.name === 'imagen-pegada.png' && <p className="text-sm text-tenue -mt-2">Imagen pegada.</p>}
      <button type="button" onClick={pegarImagen} className="boton boton-secundario w-full -mt-1">Pegar imagen del portapapeles</button>

      <div className="flex items-center gap-3 min-h-11">
        <input type="checkbox" id="toggleFondo" checked={quitarFondo} onChange={(e) => setQuitarFondo(e.target.checked)} className="w-6 h-6 shrink-0 accent-acento cursor-pointer" />
        <label htmlFor="toggleFondo" className="flex-1 py-2.5 cursor-pointer select-none">Quitar el fondo automáticamente</label>
      </div>
      <p className="text-sm text-tenue -mt-2">La primera vez descarga el modelo de recorte (~24 MB; unos 6 MB comprimidos).</p>

      <div>
        <label htmlFor="nombrePrenda" className="etiqueta">Nombre</label>
        <input id="nombrePrenda" type="text" name="nombrePrenda" autoComplete="off" required placeholder="Cazadora de cuero negra" value={nombre} onChange={(e) => { tocado.current.nombre = true; setNombre(e.target.value) }} className="campo" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="tipoPrenda" className="etiqueta">Tipo</label>
          <select id="tipoPrenda" value={tipoSeleccionado} onChange={(e) => { tocado.current.clasificacion = true; setTipoSeleccionado(e.target.value); setCategoriaId('') }} required className="campo">
            <option value="">Elegir…</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="categoria" className="etiqueta">Categoría</label>
          <select id="categoria" name="categoria" value={categoriaId} onChange={(e) => { tocado.current.clasificacion = true; setCategoriaId(e.target.value) }} required disabled={!tipoSeleccionado} className="campo disabled:opacity-50">
            <option value="">Elegir…</option>
            {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>
      {pista && <p className="text-sm text-tenue -mt-2">{pista}</p>}

      {tipos.length === 0 && (
        <p className="text-sm text-tenue">Aún no tienes tipos ni categorías: créalos en Ajustes → Tipos y Categorías.</p>
      )}

      {archivo && (
        <CamposEtiquetas
          valor={etiquetas}
          onChange={(nuevo) => { tocado.current.etiquetas = true; setEtiquetas(nuevo) }}
          sugerido={sugeridaPorIA && !tocado.current.etiquetas}
          analizando={analizando}
        />
      )}

      <button type="submit" disabled={cargando} className="boton boton-primario mt-2 w-full">
        {cargando && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
        {cargando ? estadoProceso : deseo ? 'Guardar deseo' : 'Guardar prenda'}
      </button>
    </form>
  )
}
