import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { escribir } from '../lib/offline'
import { actualizarPrenda, usePrendas } from '../lib/almacen'
import { dinero } from '../lib/estadisticas'
import { etiquetaFechaCorta, isoLocal } from '../lib/fechas'
import { consultarOutfitsDePrenda, etiquetasDePrenda, resumenFicha, textoUsos } from '../lib/ficha'
import { nombreVistaPrenda } from '../lib/transicionVista'
import { vibrar } from '../lib/vibrar'
import Icono from './Icono'
import LienzoOutfit from './LienzoOutfit'
import Miniatura from './Miniatura'

/**
 * Ficha de una prenda: foto grande, etiquetas, uso y coste, los outfits en los
 * que sale y las acciones del día a día. Se abre como una hoja más (carga
 * diferida y Atrás la cierra).
 */
export default function FichaPrenda({ prenda, mostrarToast, onEditar, onQueMePongo }) {
  const { prendas } = usePrendas()
  // El almacén manda: al anotar un uso, la ficha se actualiza sin cerrarse.
  const viva = prendas.find((p) => p.id === prenda.id) || prenda
  const nombre = viva.nombre || 'Sin nombre'
  const resumen = resumenFicha(viva)
  const etiquetas = etiquetasDePrenda(viva)
  const hoy = isoLocal(new Date())
  const yaHoy = (viva.usos || []).some((u) => u.fecha === hoy)
  const nombreVista = nombreVistaPrenda(viva.id)

  const [outfits, setOutfits] = useState([])
  const [cargandoOutfits, setCargandoOutfits] = useState(true)
  const [errorOutfits, setErrorOutfits] = useState(false)
  const [anotando, setAnotando] = useState(false)

  useEffect(() => {
    let vivo = true
    setCargandoOutfits(true)
    setErrorOutfits(false)
    consultarOutfitsDePrenda(supabase, viva.id).then((lista) => {
      if (!vivo) return
      setOutfits(lista)
      setCargandoOutfits(false)
    }).catch(() => {
      if (!vivo) return
      setOutfits([])
      setErrorOutfits(true)
      setCargandoOutfits(false)
    })
    return () => { vivo = false }
  }, [viva.id])

  async function anotarUso() {
    if (yaHoy) return mostrarToast?.('Ya está anotado que te lo pusiste hoy', 'info')
    if (anotando) return
    setAnotando(true)

    const antes = viva.usos || []
    actualizarPrenda(viva.id, { usos: [...antes, { fecha: hoy }] })
    const estado = await escribir({ tabla: 'usos', accion: 'insert', datos: { prenda_id: viva.id, fecha: hoy } })
    setAnotando(false)

    if (estado === 'error') {
      actualizarPrenda(viva.id, { usos: antes })
      return mostrarToast?.('No se pudo anotar el uso', 'error')
    }
    vibrar(20)
    mostrarToast?.(estado === 'encolada' ? 'Anotado: se enviará cuando vuelva la conexión' : 'Anotado: te lo has puesto hoy', 'exito')
  }

  return (
    <div className="flex flex-col gap-5 pt-7">
      <div
        className="relative mx-auto w-full max-w-sm aspect-4/5 rounded-2xl border border-linea bg-foto overflow-hidden"
        style={{ viewTransitionName: nombreVista }}
      >
        <Miniatura url={viva.imagen_url} alt={nombre} ancho={480} className="w-full h-full object-contain p-4 md:p-5" />
      </div>

      <div>
        <h2 className="titulo-hoja text-2xl!">{nombre}</h2>
        {etiquetas.length > 0 && (
          <ul className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-sm text-tenue" aria-label="Etiquetas">
            {etiquetas.map((etiqueta) => (
              <li key={etiqueta}>{etiqueta}</li>
            ))}
          </ul>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-lamina px-3 py-2">
          <dt className="text-sm text-tenue">Veces puesta</dt>
          <dd className="font-semibold">{textoUsos(resumen.usos)}</dd>
        </div>
        <div className="rounded-xl bg-lamina px-3 py-2">
          <dt className="text-sm text-tenue">Último uso</dt>
          <dd className="font-semibold">{resumen.ultima ? etiquetaFechaCorta(resumen.ultima) : 'Nunca'}</dd>
        </div>
        {resumen.precio !== null && (
          <>
            <div className="rounded-xl bg-lamina px-3 py-2">
              <dt className="text-sm text-tenue">Precio</dt>
              <dd className="font-semibold">{dinero(resumen.precio)}</dd>
            </div>
            <div className="rounded-xl bg-lamina px-3 py-2">
              <dt className="text-sm text-tenue">Coste por uso</dt>
              <dd className="font-semibold">{resumen.coste === null ? 'Sin estrenar' : dinero(resumen.coste)}</dd>
            </div>
          </>
        )}
      </dl>

      <section>
        <h3 className="etiqueta">Outfits con esta prenda</h3>
        {cargandoOutfits ? (
          <div role="status" aria-label="Cargando outfits" className="flex gap-2">
            {[0, 1, 2].map((i) => <div key={i} className="esqueleto shrink-0 w-32 aspect-square" />)}
          </div>
        ) : errorOutfits ? (
          <p role="alert" className="aviso-error">No se pudieron cargar los outfits.</p>
        ) : outfits.length === 0 ? (
          <p className="text-sm text-tenue">Todavía no está en ningún outfit.</p>
        ) : (
          <ul aria-label="Outfits que contienen esta prenda" className="flex gap-2 overflow-x-auto sin-barra pb-1 -mx-1 px-1">
            {outfits.map((conjunto) => (
              <li key={conjunto.id} className="shrink-0 w-32 rounded-xl border border-linea bg-superficie overflow-hidden">
                <LienzoOutfit conjunto={conjunto} soloLectura ancho={240} />
                <p className="px-2 py-1 text-xs font-medium truncate">{conjunto.nombre || 'Outfit'}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-col gap-2">
        <button
          onClick={anotarUso}
          disabled={yaHoy || anotando}
          aria-label={`Anotar que hoy te has puesto ${nombre}`}
          className="boton boton-primario"
        >
          <Icono nombre="marca" className="w-5 h-5" />
          {yaHoy ? 'Ya te lo has puesto hoy' : 'Me lo he puesto hoy'}
        </button>
        <div className="flex flex-col gap-2">
          <button onClick={() => onEditar(viva)} aria-label={`Editar ${nombre}`} className="boton boton-secundario">Editar</button>
          <button onClick={() => onQueMePongo(viva)} aria-label={`Qué me pongo con ${nombre}`} className="boton boton-secundario">Qué me pongo con esto</button>
        </div>
      </div>
    </div>
  )
}
