import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { borrarArchivo } from '../lib/imagenes'
import { prepararFoto, subirFoto } from '../lib/imagen'
import { colorDeImagen } from '../lib/colores'
import {
  etiquetasDeFormulario, etiquetasParaGuardar, hayEtiquetas, insertarPrenda, origenEtiquetas, pedirEtiquetas, sinAcentos,
} from '../lib/etiquetas'
import CamposEtiquetas from './CamposEtiquetas'

export default function FormularioPrenda({ onExito }) {
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

  // La foto se prepara (comprime, recorta) en cuanto se elige, mientras rellenas el resto.
  const tarea = useRef(null)
  // Lo que ya has tocado a mano no lo pisan las sugerencias.
  const tocado = useRef({ nombre: false, clasificacion: false, etiquetas: false })
  const listas = useRef({ tipos: [], categorias: [] })
  listas.current = { tipos, categorias }

  useEffect(() => {
    supabase.from('tipos').select('*').then(({ data }) => setTipos(data || []))
    supabase.from('categorias').select('*').then(({ data }) => setCategorias(data || []))
  }, [])

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
        if (tocado.current.clasificacion || !sugerencia.tipo) return
        const { tipos: ts, categorias: cs } = listas.current
        const tipo = ts.find((t) => sinAcentos(t.nombre) === sinAcentos(sugerencia.tipo))
        const categoria = tipo && cs.find((c) => c.tipo_id === tipo.id && sinAcentos(c.nombre) === sinAcentos(sugerencia.categoria))
        if (tipo) setTipoSeleccionado(tipo.id)
        if (categoria) setCategoriaId(categoria.id)
        else setPista(`La IA sugiere ${sugerencia.tipo}${sugerencia.categoria ? ` › ${sugerencia.categoria}` : ''}${tipo ? '' : ', que aún no existe en tus listas'}.`)
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
        { nombre: nombreLimpio, imagen_url: subida.url, categoria_id: categoriaId },
        { ...fila, etiquetas_auto: auto },
      )

      if (errPrenda) {
        // Si la fila falla, la foto no se queda huérfana en el bucket.
        await borrarArchivo(subida.url)
        throw new Error('Error en base de datos al guardar la ropa.')
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
      <h2 className="titulo-hoja">Añadir prenda</h2>

      {errorFormulario && (
        <div role="alert" className="aviso-error">{errorFormulario}</div>
      )}

      <div>
        <label htmlFor="imagen" className="etiqueta">Fotografía</label>
        <input id="imagen" type="file" name="imagen" accept="image/*" required onChange={elegirFoto} className="campo p-1.5! text-tenue file:mr-3 file:min-h-9 file:px-3 file:border-0 file:rounded-lg file:bg-lamina file:text-tinta file:font-semibold file:cursor-pointer" />
      </div>

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
        {cargando ? estadoProceso : 'Guardar prenda'}
      </button>
    </form>
  )
}
