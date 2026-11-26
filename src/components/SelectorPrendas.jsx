import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { etiquetaDia } from '../lib/fechas'
import Icono from './Icono'
import Miniatura from './Miniatura'

export default function SelectorPrendas({ fecha, nombreSemana, onGuardar, onCancelar }) {
  const [prendas, setPrendas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [seleccionadas, setSeleccionadas] = useState([])
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let vivo = true
    supabase
      .from('prendas')
      .select('id, nombre, imagen_url, categorias(nombre, tipos(nombre))')
      .order('creado_en', { ascending: false })
      .then(({ data }) => {
        if (!vivo) return
        setPrendas(data || [])
        setCargando(false)
      })
    return () => { vivo = false }
  }, [])

  const filtradas = prendas.filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  const alternar = (id) => {
    setSeleccionadas((prev) => (
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    ))
  }

  async function enviar(e) {
    e.preventDefault()
    if (seleccionadas.length === 0) return
    setGuardando(true)
    try {
      await onGuardar(nombre.trim() || `Look de ${etiquetaDia(fecha)}`, seleccionadas)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4 text-left">
      <div>
        <h2 className="titulo-hoja">Outfit del {etiquetaDia(fecha)}</h2>
        <p className="text-sm text-tenue mt-1 truncate">{nombreSemana}</p>
      </div>

      <div className="relative">
        <Icono nombre="buscar" className="w-5 h-5 absolute left-3.5 top-3.5 text-tenue pointer-events-none" />
        <input
          type="search"
          autoComplete="off"
          aria-label="Buscar prenda"
          placeholder="Buscar prenda"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="campo pl-11!"
        />
      </div>

      {cargando ? (
        <div role="status" aria-label="Cargando" className="grid grid-cols-3 gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="esqueleto aspect-square rounded-xl" />)}
        </div>
      ) : filtradas.length === 0 ? (
        <p className="py-8 text-center text-tenue">
          {prendas.length === 0 ? 'Tu armario está vacío.' : 'Nada coincide con la búsqueda.'}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 max-h-[38dvh] overflow-y-auto overscroll-contain pr-1">
          {filtradas.map((prenda) => {
            const activa = seleccionadas.includes(prenda.id)
            return (
              <button
                key={prenda.id}
                type="button"
                onClick={() => alternar(prenda.id)}
                aria-pressed={activa}
                className={`relative aspect-square rounded-xl overflow-hidden border-2 bg-foto p-1.5 transition-colors ${
                  activa ? 'border-acento' : 'border-transparent'
                }`}
              >
                <Miniatura url={prenda.imagen_url} alt="" className="w-full h-full object-contain" />
                <span className="absolute inset-x-0 bottom-0 bg-superficie/90 px-1 py-0.5 text-[11px] font-medium truncate">
                  {prenda.nombre}
                </span>
                {activa && (
                  <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-acento text-sobre-acento grid place-items-center">
                    <Icono nombre="marca" className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div>
        <label htmlFor="nombreOutfit" className="etiqueta">Nombre del outfit</label>
        <input
          id="nombreOutfit"
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoComplete="off"
          placeholder={`Look de ${etiquetaDia(fecha)}`}
          className="campo"
        />
      </div>

      <p className="text-sm text-tenue -mt-2">{seleccionadas.length} {seleccionadas.length === 1 ? 'prenda elegida' : 'prendas elegidas'}</p>

      <div className="flex gap-3">
        <button type="submit" disabled={guardando || seleccionadas.length === 0} className="boton boton-primario flex-1">
          {guardando ? 'Guardando…' : 'Guardar outfit'}
        </button>
        <button type="button" onClick={onCancelar} className="boton boton-secundario flex-1">Cancelar</button>
      </div>
    </form>
  )
}
