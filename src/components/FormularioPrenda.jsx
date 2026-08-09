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
      setEstadoProceso('Comprimiendo imagen (WebP)...')
      
      const opcionesCompresion = {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1080,
        useWebWorker: true,
        fileType: 'image/webp'
      }
      let archivoProcesado = await imageCompression(archivoOriginal, opcionesCompresion)

      if (quitarFondo) {
        setEstadoProceso('IA: Recortando fondo...')
        const blobSinFondo = await removeBackground(archivoProcesado)
        archivoProcesado = new File([blobSinFondo], `recorte-${Date.now()}.png`, { type: 'image/png' })
      }

      const nombreArchivo = `prenda-${Date.now()}.${quitarFondo ? 'png' : 'webp'}`

      setEstadoProceso('Subiendo a la nube...')
      const { error: errImg } = await supabase.storage.from('prendas').upload(nombreArchivo, archivoProcesado)
      if (errImg) throw new Error('Error al subir imagen.')
      
      const { data: { publicUrl } } = supabase.storage.from('prendas').getPublicUrl(nombreArchivo)

      setEstadoProceso('Guardando registro...')
      const { error: errPrenda } = await supabase.from('prendas').insert([{
        nombre,
        imagen_url: publicUrl,
        categoria_id: categoriaId
      }])

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
    <form onSubmit={manejarEnvio} className="flex flex-col gap-4 text-left mt-2">
      <div>
        <label className="block text-sm font-bold text-slate-700 in-[.modo-oscuro_&]:text-[#D1C4E9]">1. Fotografía</label>
        <input type="file" name="imagen" accept="image/*" required className="border border-rose-200 in-[.modo-oscuro_&]:border-[#433D60] w-full p-2 rounded-xl bg-white in-[.modo-oscuro_&]:bg-[#2A273F] cursor-pointer shadow-sm text-slate-800 in-[.modo-oscuro_&]:text-[#E0D8F0] mt-1" />
      </div>

      <div className="flex items-center gap-3 bg-rose-50/50 in-[.modo-oscuro_&]:bg-[#1F1D2B]/50 p-3 rounded-xl border border-rose-100 in-[.modo-oscuro_&]:border-[#322F44]">
        <input type="checkbox" id="toggleFondo" checked={quitarFondo} onChange={(e) => setQuitarFondo(e.target.checked)} className="w-5 h-5 cursor-pointer accent-teal-500 in-[.modo-oscuro_&]:accent-[#7E67C9]" />
        <label htmlFor="toggleFondo" className="text-sm font-bold text-slate-700 in-[.modo-oscuro_&]:text-[#D1C4E9] cursor-pointer select-none">✨ Recortar fondo con Inteligencia Artificial</label>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 in-[.modo-oscuro_&]:text-[#D1C4E9]">2. Nombre Descriptivo (Ej. Pantalón negro cuero)</label>
        <input type="text" name="nombrePrenda" autoComplete="off" required className="border border-rose-200 in-[.modo-oscuro_&]:border-[#433D60] w-full p-3 rounded-xl outline-none focus:ring-2 focus:ring-teal-400 in-[.modo-oscuro_&]:focus:ring-[#A394D6] bg-white in-[.modo-oscuro_&]:bg-[#2A273F] text-slate-800 in-[.modo-oscuro_&]:text-[#E0D8F0] shadow-sm mt-1" />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 in-[.modo-oscuro_&]:text-[#D1C4E9]">3. Tipo</label>
          <select value={tipoSeleccionado} onChange={(e) => setTipoSeleccionado(e.target.value)} required className="border border-rose-200 in-[.modo-oscuro_&]:border-[#433D60] w-full p-3 rounded-xl bg-white in-[.modo-oscuro_&]:bg-[#2A273F] text-slate-800 in-[.modo-oscuro_&]:text-[#E0D8F0] cursor-pointer shadow-sm outline-none focus:ring-2 focus:ring-[#A394D6] mt-1">
            <option value="">Seleccionar...</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 in-[.modo-oscuro_&]:text-[#D1C4E9]">4. Prenda Específica</label>
          <select name="categoria" required disabled={!tipoSeleccionado} className="border border-rose-200 in-[.modo-oscuro_&]:border-[#433D60] w-full p-3 rounded-xl bg-white in-[.modo-oscuro_&]:bg-[#2A273F] text-slate-800 in-[.modo-oscuro_&]:text-[#E0D8F0] cursor-pointer shadow-sm outline-none focus:ring-2 focus:ring-[#A394D6] disabled:opacity-50 mt-1">
            <option value="">Seleccionar...</option>
            {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      <button type="submit" disabled={cargando} className="flex items-center justify-center gap-3 bg-teal-400 in-[.modo-oscuro_&]:bg-[#7E67C9] text-slate-900 in-[.modo-oscuro_&]:text-white font-bold py-3 w-full mt-2 rounded-xl cursor-pointer hover:bg-teal-500 in-[.modo-oscuro_&]:hover:bg-[#9985D8] shadow-lg active:scale-95 transition-transform disabled:opacity-80 disabled:cursor-not-allowed">
        {cargando && (
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {cargando ? estadoProceso : 'Guardar Prenda'}
      </button>
    </form>
  )
}