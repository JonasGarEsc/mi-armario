import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { cargaMasiva, guardarRevisadas, sePuedeGuardar, useCargaMasiva } from '../lib/cargaMasivaApp'
import { resumenCarga } from '../lib/cargaMasiva'
import { clasificarSugerencia } from '../lib/etiquetas'
import { vibrar } from '../lib/vibrar'

const TEXTO_ESTADO = { cola: 'En cola', preparando: 'Preparando…', analizando: 'Mirando la prenda…', lista: 'Lista', error: 'Error' }

/** Elegir varias fotos, verlas prepararse en segundo plano y revisar nombres y categorías. */
export default function CargaMasiva({ mostrarToast, onGuardadas }) {
  const items = useCargaMasiva()
  const [tipos, setTipos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [quitarFondo, setQuitarFondo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const r = resumenCarga(items)

  useEffect(() => {
    supabase.from('tipos').select('*').order('nombre').then(({ data }) => setTipos(data || []))
    supabase.from('categorias').select('*').order('nombre').then(({ data }) => setCategorias(data || []))
  }, [])

  // Cuando una foto queda lista, se propone su tipo y categoría con lo que ya tienes.
  useEffect(() => {
    if (tipos.length === 0) return
    for (const item of items) {
      if (item.estado !== 'lista' || item.clasificada) continue
      cargaMasiva.editar(item.id, { clasificada: true, ...clasificarSugerencia(item.sugerencia, tipos, categorias) })
    }
  }, [items, tipos, categorias])

  function elegir(e) {
    const archivos = [...(e.target.files || [])]
    e.target.value = ''
    if (archivos.length === 0) return
    vibrar(15)
    cargaMasiva.encolar(archivos, { quitarFondo })
  }

  async function guardar() {
    setGuardando(true)
    const { guardadas, fallos } = await guardarRevisadas(items)
    setGuardando(false)
    if (guardadas > 0) {
      vibrar([40, 40])
      mostrarToast(`${guardadas} ${guardadas === 1 ? 'prenda guardada' : 'prendas guardadas'}${fallos ? `; ${fallos} con error` : ''}`, fallos ? 'info' : 'exito')
      onGuardadas(cargaMasiva.obtener().length === 0)
    } else if (fallos > 0) {
      mostrarToast('No se pudo guardar. Revisa los errores.', 'error')
    }
  }

  const guardables = items.filter(sePuedeGuardar).length

  return (
    <div className="flex flex-col gap-4 text-left min-h-0">
      <h2 className="titulo-hoja">Subir varias prendas</h2>

      <div className="flex items-center gap-3 min-h-11">
        <input type="checkbox" id="fondoMasivo" checked={quitarFondo} onChange={(e) => setQuitarFondo(e.target.checked)} className="w-6 h-6 shrink-0 accent-acento cursor-pointer" />
        <label htmlFor="fondoMasivo" className="flex-1 py-2.5 cursor-pointer select-none">Quitar el fondo de las fotos</label>
      </div>
      <label className="boton boton-secundario cursor-pointer w-full">
        {items.length === 0 ? 'Elegir fotos' : 'Añadir más fotos'}
        <input type="file" accept="image/*" multiple onChange={elegir} className="sr-only" />
      </label>
      <p className="text-sm text-tenue -mt-2">Se preparan una a una en segundo plano: puedes cerrar esta hoja y seguir usando la app.</p>

      {items.length > 0 && (
        <>
          <p role="status" className="font-semibold">
            {r.activas > 0 ? `Preparando ${r.terminadas + 1 > r.total ? r.total : r.terminadas + 1} de ${r.total}…` : `${r.listas} ${r.listas === 1 ? 'lista' : 'listas'} para revisar${r.errores ? ` · ${r.errores} con error` : ''}`}
          </p>

          <ul className="flex flex-col gap-3 overflow-y-auto max-h-[50dvh] pr-1">
            {items.map((item) => (
              <li key={item.id} className="rounded-xl border border-linea p-3 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-14 h-14 shrink-0 rounded-lg bg-foto p-1 flex items-center justify-center">
                    {item.vistaPrevia ? <img src={item.vistaPrevia} alt="" className="w-full h-full object-contain" /> : <span className="esqueleto w-full h-full" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{item.nombre || item.archivo.name}</p>
                    <p className={`text-sm ${item.estado === 'error' ? 'text-peligro' : 'text-tenue'}`}>
                      {item.estado === 'error' ? item.mensaje : item.estado === 'lista' ? TEXTO_ESTADO.lista : item.mensaje || TEXTO_ESTADO[item.estado]}
                    </p>
                  </div>
                  {item.estado === 'error' && (
                    <button onClick={() => cargaMasiva.reintentar(item.id)} className="boton boton-secundario min-h-11! px-3!">Reintentar</button>
                  )}
                  <button onClick={() => cargaMasiva.descartar(item.id)} aria-label={`Descartar ${item.nombre || item.archivo.name}`} className="boton-icono text-tenue">×</button>
                </div>

                {item.estado === 'lista' && (
                  <div className="flex flex-col gap-2">
                    <input value={item.nombre} onChange={(e) => cargaMasiva.editar(item.id, { nombre: e.target.value })} aria-label="Nombre de la prenda" placeholder="Nombre" className="campo" />
                    <div className="grid grid-cols-2 gap-2">
                      <select value={item.tipoId} onChange={(e) => cargaMasiva.editar(item.id, { tipoId: e.target.value, categoriaId: '' })} aria-label="Tipo" className="campo">
                        <option value="">Tipo…</option>
                        {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                      </select>
                      <select value={item.categoriaId} onChange={(e) => cargaMasiva.editar(item.id, { categoriaId: e.target.value })} disabled={!item.tipoId} aria-label="Categoría" className="campo disabled:opacity-50">
                        <option value="">Categoría…</option>
                        {categorias.filter((c) => c.tipo_id === item.tipoId).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>
                    {item.pista && <p className="text-xs text-tenue">{item.pista}</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <button onClick={guardar} disabled={guardando || guardables === 0} className="boton boton-primario w-full">
            {guardando ? 'Guardando…' : `Guardar ${guardables} ${guardables === 1 ? 'prenda' : 'prendas'}`}
          </button>
          {r.listas > guardables && <p className="text-sm text-tenue -mt-2">Faltan nombre o categoría en {r.listas - guardables}: no se guardarán hasta que los pongas.</p>}
        </>
      )}
    </div>
  )
}
