import { useState, useEffect, lazy, Suspense } from 'react'
import { supabase } from '../supabase'
import { borrarArchivo, urlImagen } from '../lib/imagenes'
import { prepararFoto, subirFoto } from '../lib/imagen'
import { fotoDesdeUrl } from '../lib/retoque'
import { actualizarPrenda, etiquetasCambiadas, etiquetasDeFormulario, etiquetasParaGuardar } from '../lib/etiquetas'
import CamposEtiquetas from './CamposEtiquetas'
import Miniatura from './Miniatura'

// El lienzo de retoque solo se descarga al abrirlo.
const RetoqueRecorte = lazy(() => import('./RetoqueRecorte'))

export default function FormularioEdicion({ prenda, onExito, onCancelar }) {
  const [tipos, setTipos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [tipoSeleccionado, setTipoSeleccionado] = useState(prenda.categorias?.tipos?.id || prenda.tipo_id || '')
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(prenda.categoria_id || '')
  const [guardando, setGuardando] = useState(false)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [quitarFondo, setQuitarFondo] = useState(false)
  const [estado, setEstado] = useState('')
  const [previsualizacion, setPrevisualizacion] = useState(null)
  const [etiquetas, setEtiquetas] = useState(() => etiquetasDeFormulario(prenda))
  const [procesandoFoto, setProcesandoFoto] = useState('')
  const [retoque, setRetoque] = useState(false)

  useEffect(() => {
    async function cargarListas() {
      const { data: dataTipos } = await supabase.from('tipos').select('*').order('nombre')
      if (dataTipos) setTipos(dataTipos)
      const { data: dataCat } = await supabase.from('categorias').select('*').order('nombre')
      if (dataCat) setCategorias(dataCat)
    }
    cargarListas()
  }, [])

  useEffect(() => {
    if (!archivo) {
      setPrevisualizacion(null)
      return
    }
    const url = URL.createObjectURL(archivo)
    setPrevisualizacion(url)
    return () => URL.revokeObjectURL(url)
  }, [archivo])

  const categoriasFiltradas = categorias.filter(c => c.tipo_id === tipoSeleccionado)

  async function recortarDeNuevo() {
    if (procesandoFoto || guardando) return
    setErrorFormulario('')
    setRetoque(false)
    setProcesandoFoto('Preparando recorte…')
    try {
      // La foto actual es la elegida en este formulario o, si no, la guardada.
      const original = archivo || await fotoDesdeUrl(prenda.imagen_url, 1200, urlImagen)
      const recortada = await prepararFoto(original, { quitarFondo: true, onEstado: setProcesandoFoto })
      setArchivo(new File([recortada], 'recorte.png', { type: recortada.type || 'image/png' }))
      setQuitarFondo(false)
    } catch (error) {
      setErrorFormulario(error.message || 'No se pudo recortar la foto.')
    } finally {
      setProcesandoFoto('')
    }
  }

  function aplicarRetoque(nuevaFoto) {
    setArchivo(nuevaFoto)
    setQuitarFondo(false)
    setRetoque(false)
  }

  async function manejarEdicion(e) {
    e.preventDefault()
    if (procesandoFoto) return
    setGuardando(true)
    setErrorFormulario('')
    const nuevoNombre = e.target.nombrePrenda.value.trim()

    if (!nuevoNombre || !categoriaSeleccionada) {
      setErrorFormulario('Faltan datos obligatorios.')
      setGuardando(false)
      return
    }

    let nuevaFoto = null
    try {
      if (archivo) {
        const procesada = await prepararFoto(archivo, { quitarFondo, onEstado: setEstado })
        nuevaFoto = await subirFoto(procesada, { onEstado: setEstado })
      }

      const cambios = { nombre: nuevoNombre, categoria_id: categoriaSeleccionada }
      if (nuevaFoto) cambios.imagen_url = nuevaFoto.url

      // Si cambias algo a mano, la IA ya no pisa esta prenda al etiquetar el armario.
      const fila = etiquetasParaGuardar(etiquetas)
      const editadas = etiquetasCambiadas(prenda, fila)
      const error = await actualizarPrenda(supabase, prenda.id, cambios, editadas ? { ...fila, etiquetas_auto: false } : {})
      if (error) {
        if (nuevaFoto) await borrarArchivo(nuevaFoto.url)
        throw new Error('Error al actualizar la prenda.')
      }

      // La foto vieja solo se borra cuando la nueva ya está guardada.
      if (nuevaFoto) await borrarArchivo(prenda.imagen_url)
      onExito()
    } catch (error) {
      setErrorFormulario(error.message || 'No se pudo guardar la prenda.')
    } finally {
      setGuardando(false)
      setEstado('')
    }
  }

  async function cambiarArchivada() {
    setGuardando(true)
    setErrorFormulario('')
    const { error } = await supabase.from('prendas').update({ archivada: !prenda.archivada }).eq('id', prenda.id)
    setGuardando(false)
    if (error) return setErrorFormulario('No se pudo archivar. ¿Has ejecutado actualizacion-v4.sql en Supabase?')
    onExito()
  }

  return (
    <form onSubmit={manejarEdicion} className="flex flex-col gap-4 text-left">
      <h2 className="titulo-hoja">Editar prenda</h2>

      {errorFormulario && (
        <div role="alert" className="aviso-error">{errorFormulario}</div>
      )}

      <div className="flex justify-center">
        <div className="w-32 h-32 p-2 bg-lamina rounded-xl">
          {previsualizacion ? (
            <img src={previsualizacion} alt="Vista previa" className="w-full h-full object-contain" />
          ) : (
            <Miniatura url={prenda.imagen_url} alt="Vista previa" className="w-full h-full object-contain" />
          )}
        </div>
      </div>

      <div>
        <label htmlFor="nuevaFoto" className="etiqueta">Cambiar foto (opcional)</label>
        <input
          id="nuevaFoto"
          type="file"
          accept="image/*"
          onChange={(e) => setArchivo(e.target.files?.[0] || null)}
          className="campo p-1.5! text-tenue file:mr-3 file:min-h-9 file:px-3 file:border-0 file:rounded-lg file:bg-lamina file:text-tinta file:font-semibold file:cursor-pointer"
        />
      </div>

      <div className="flex items-center gap-3 min-h-11 -mt-2">
        <input type="checkbox" id="editarFondo" checked={quitarFondo} onChange={(e) => setQuitarFondo(e.target.checked)} className="w-6 h-6 shrink-0 accent-acento cursor-pointer" />
        <label htmlFor="editarFondo" className="flex-1 py-2.5 cursor-pointer select-none">Quitar el fondo de la foto nueva</label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={recortarDeNuevo} disabled={guardando || Boolean(procesandoFoto)} className="boton boton-secundario min-h-11! text-sm!">
          Recortar de nuevo
        </button>
        <button type="button" onClick={() => setRetoque(valor => !valor)} disabled={guardando || Boolean(procesandoFoto)} aria-expanded={retoque} className="boton boton-secundario min-h-11! text-sm!">
          {retoque ? 'Cerrar retoque' : 'Retocar a mano'}
        </button>
      </div>
      {procesandoFoto && <p role="status" className="text-sm text-tenue -mt-2">{procesandoFoto}</p>}

      {retoque && (
        <Suspense fallback={<div role="status" aria-label="Cargando retoque" className="esqueleto h-64 w-full" />}>
          <RetoqueRecorte url={prenda.imagen_url} archivo={archivo} onAplicar={aplicarRetoque} onCancelar={() => setRetoque(false)} />
        </Suspense>
      )}

      <div>
        <label htmlFor="nombrePrenda" className="etiqueta">Nombre descriptivo</label>
        <input id="nombrePrenda" type="text" name="nombrePrenda" autoComplete="off" defaultValue={prenda.nombre} required className="campo" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="tipoPrenda" className="etiqueta">Tipo</label>
          <select id="tipoPrenda" value={tipoSeleccionado} onChange={(e) => { setTipoSeleccionado(e.target.value); setCategoriaSeleccionada('') }} required className="campo">
            <option value="">Seleccionar...</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="categoria" className="etiqueta">Prenda específica</label>
          <select id="categoria" name="categoria" value={categoriaSeleccionada} onChange={(e) => setCategoriaSeleccionada(e.target.value)} required disabled={!tipoSeleccionado} className="campo disabled:opacity-50">
            <option value="">Seleccionar...</option>
            {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      <CamposEtiquetas valor={etiquetas} onChange={setEtiquetas} sugerido={prenda.etiquetas_auto === true} />

      {prenda.archivada && <p className="text-sm text-tenue">Esta prenda está archivada: no sale en la galería ni en las propuestas.</p>}

      <div className="flex gap-3 mt-2">
        <button type="submit" disabled={guardando || Boolean(procesandoFoto)} className="boton boton-primario flex-1">
          {guardando ? (estado || 'Guardando...') : 'Actualizar'}
        </button>
        <button type="button" onClick={onCancelar} className="boton boton-secundario flex-1">Cancelar</button>
      </div>
      <button type="button" onClick={cambiarArchivada} disabled={guardando || Boolean(procesandoFoto)} className="boton boton-secundario w-full">
        {prenda.archivada ? 'Recuperar del archivo' : 'Archivar (conserva su historial)'}
      </button>
    </form>
  )
}
