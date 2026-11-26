import { FAMILIAS_COLOR, familiaDeColor } from '../lib/colores'
import {
  ESTAMPADOS, LARGOS, NIVELES_ABRIGO, NIVELES_FORMALIDAD, TEMPORADAS,
} from '../lib/etiquetas'

const chip = (activo) =>
  `min-h-11 px-4 rounded-full border text-sm font-medium ${activo ? 'bg-acento text-sobre-acento border-acento' : 'bg-superficie border-linea text-tinta'}`

const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1)

/**
 * Colores, temporada, abrigo, formalidad, largo, estampado y precio de una prenda.
 * `valor` y `onChange` van con el formato de `etiquetasDeFormulario`.
 * `sugerido` marca los datos que ha puesto la IA y que hay que confirmar.
 */
export default function CamposEtiquetas({ valor, onChange, sugerido = false, analizando = false }) {
  const cambiar = (campo, nuevo) => onChange({ ...valor, [campo]: nuevo })

  function cambiarColores(colores) {
    // La familia sigue al color principal, salvo que se haya puesto a mano.
    onChange({ ...valor, colores, familia_color: colores.length ? familiaDeColor(colores[0]) || valor.familia_color : '' })
  }

  const alternarTemporada = (t) =>
    cambiar('temporada', valor.temporada.includes(t) ? valor.temporada.filter((x) => x !== t) : [...valor.temporada, t])

  return (
    <details open={sugerido} className="rounded-xl border border-linea group">
      <summary className="min-h-12 px-4 flex items-center gap-2 cursor-pointer font-semibold list-none">
        <span className="flex-1">Detalles de la prenda</span>
        {analizando && <span className="text-xs font-medium text-tenue">Analizando la foto…</span>}
        {sugerido && !analizando && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-acento text-sobre-acento">Sugerido</span>
        )}
      </summary>

      <div className="flex flex-col gap-4 p-4 pt-1">
        {sugerido && <p className="text-sm text-tenue">Lo ha propuesto la IA mirando la foto. Corrige lo que no sea así.</p>}

        <div>
          <span className="etiqueta">Colores</span>
          <div className="flex flex-wrap items-center gap-2">
            {valor.colores.map((c, i) => (
              <span key={c + i} className="inline-flex items-center gap-1.5 min-h-11 pl-2 pr-1 rounded-full border border-linea">
                <span className="w-6 h-6 rounded-full border border-linea" style={{ background: c }} aria-hidden="true" />
                <span className="text-sm tabular-nums">{c}</span>
                <button type="button" onClick={() => cambiarColores(valor.colores.filter((_, j) => j !== i))} aria-label={`Quitar el color ${c}`} className="w-8 h-8 rounded-full text-tenue">×</button>
              </span>
            ))}
            {valor.colores.length < 3 && (
              <label className="inline-flex items-center justify-center min-h-11 px-4 rounded-full border border-dashed border-linea text-sm text-tenue cursor-pointer">
                + Color
                <input
                  type="color"
                  value="#808080"
                  onChange={(e) => cambiarColores([...valor.colores, e.target.value.toLowerCase()].slice(0, 3))}
                  className="sr-only"
                />
              </label>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="familiaColor" className="etiqueta">Familia de color</label>
            <select id="familiaColor" value={valor.familia_color} onChange={(e) => cambiar('familia_color', e.target.value)} className="campo">
              <option value="">Sin indicar</option>
              {FAMILIAS_COLOR.map((f) => <option key={f} value={f}>{mayuscula(f)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="estampadoPrenda" className="etiqueta">Estampado</label>
            <select id="estampadoPrenda" value={valor.estampado} onChange={(e) => cambiar('estampado', e.target.value)} className="campo">
              <option value="">Sin indicar</option>
              {ESTAMPADOS.map((x) => <option key={x} value={x}>{mayuscula(x)}</option>)}
            </select>
          </div>
        </div>

        <div>
          <span className="etiqueta">Temporada</span>
          <div className="flex flex-wrap gap-2">
            {TEMPORADAS.map((t) => (
              <button key={t} type="button" aria-pressed={valor.temporada.includes(t)} onClick={() => alternarTemporada(t)} className={chip(valor.temporada.includes(t))}>
                {mayuscula(t)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="abrigoPrenda" className="etiqueta">Abrigo</label>
            <select id="abrigoPrenda" value={valor.abrigo} onChange={(e) => cambiar('abrigo', e.target.value)} className="campo">
              <option value="">Sin indicar</option>
              {NIVELES_ABRIGO.map((n, i) => <option key={n} value={i + 1}>{i + 1} · {n}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="formalidadPrenda" className="etiqueta">Formalidad</label>
            <select id="formalidadPrenda" value={valor.formalidad} onChange={(e) => cambiar('formalidad', e.target.value)} className="campo">
              <option value="">Sin indicar</option>
              {NIVELES_FORMALIDAD.map((n, i) => <option key={n} value={i + 1}>{i + 1} · {n}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="largoPrenda" className="etiqueta">Largo (cómo cae en el maniquí)</label>
            <select id="largoPrenda" value={valor.largo} onChange={(e) => cambiar('largo', e.target.value)} className="campo">
              <option value="">Automático</option>
              {LARGOS.map((l) => <option key={l} value={l}>{mayuscula(l)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="precioPrenda" className="etiqueta">Precio (€, opcional)</label>
            <input id="precioPrenda" type="text" inputMode="decimal" autoComplete="off" placeholder="29,95" value={valor.precio} onChange={(e) => cambiar('precio', e.target.value)} className="campo" />
          </div>
        </div>
      </div>
    </details>
  )
}
