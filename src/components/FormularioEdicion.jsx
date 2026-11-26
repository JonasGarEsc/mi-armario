import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function FormularioEdicion({ prenda, onExito, onCancelar }) {
  const [tipos, setTipos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [tipoSeleccionado, setTipoSeleccionado] = useState(prenda.categorias?.tipos?.id || '')
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(prenda.categoria_id || '')
  const [guardando, setGuardando] = useState(false)
  const [errorFormulario, setErrorFormulario] = useState('')

  useEffect(() => {
    async function cargarListas() {
      const { data: dataTipos } = await supabase.from('tipos').select('*').order('nombre')
      if (dataTipos) setTipos(dataTipos)
      const { data: dataCat } = await supabase.from('categorias').select('*').order('nombre')
      if (dataCat) setCategorias(dataCat)
    }
    cargarListas()
  }, [])

  const categoriasFiltradas = categorias.filter(c => c.tipo_id === tipoSeleccionado)

  async function manejarEdicion(e) {
    e.preventDefault()
    setGuardando(true)
    setErrorFormulario('')
    const nuevoNombre = e.target.nombrePrenda.value.trim()

    if (!nuevoNombre || !categoriaSeleccionada) {
      setErrorFormulario('Faltan datos obligatorios.')
      setGuardando(false)
      return
    }

    const { error } = await supabase.from('prendas').update({ nombre: nuevoNombre, categoria_id: categoriaSeleccionada }).eq('id', prenda.id)

    if (error) setErrorFormulario('Error al actualizar la prenda.')
    else onExito()
    
    setGuardando(false)
  }

  return (
    <form onSubmit={manejarEdicion} className="flex flex-col gap-4 text-left">
      <h2 className="titulo-hoja">Editar Prenda</h2>

      {errorFormulario && (
        <div role="alert" className="aviso-error">{errorFormulario}</div>
      )}
      
      <div className="flex justify-center">
        <div className="w-32 h-32 p-2 bg-lamina rounded-xl">
          <img src={prenda.imagen_url} alt="Vista previa" className="w-full h-full object-contain" />
        </div>
      </div>

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
          <label htmlFor="categoria" className="etiqueta">Prenda Específica</label>
          <select id="categoria" name="categoria" value={categoriaSeleccionada} onChange={(e) => setCategoriaSeleccionada(e.target.value)} required disabled={!tipoSeleccionado} className="campo disabled:opacity-50">
            <option value="">Seleccionar...</option>
            {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-3 mt-2">
        <button type="submit" disabled={guardando} className="boton boton-primario flex-1">{guardando ? 'Guardando...' : 'Actualizar'}</button>
        <button type="button" onClick={onCancelar} className="boton boton-secundario flex-1">Cancelar</button>
      </div>
    </form>
  )
}
