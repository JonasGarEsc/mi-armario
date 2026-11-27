import { useMemo } from 'react'
import { supabase } from '../supabase'
import { PUNTO_FAMILIA } from '../lib/colores'
import { dinero, costePorUso, estadisticasArmario, numUsos } from '../lib/estadisticas'
import { isoLocal } from '../lib/fechas'
import { huecosDelArmario } from '../lib/huecos'
import { vibrar } from '../lib/vibrar'
import { actualizarPrenda, usePrendas } from '../lib/almacen'
import GraficoBarras from './GraficoBarras'
import Miniatura from './Miniatura'

const chipAccion = 'min-h-11 px-3 rounded-full border border-linea bg-superficie text-sm font-medium whitespace-nowrap'

function Fila({ prenda, dato, children }) {
  return (
    <li className="py-2">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 shrink-0 rounded-lg bg-foto p-1"><Miniatura url={prenda.imagen_url} alt="" className="w-full h-full object-contain" /></span>
        <span className="flex-1 min-w-0 truncate text-sm font-medium">{prenda.nombre}</span>
        {dato && <span className="shrink-0 text-sm text-tenue tabular-nums">{dato}</span>}
      </div>
      {children}
    </li>
  )
}

function Bloque({ titulo, vacio, hijos, children }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-lg font-semibold">{titulo}</h3>
      {hijos === 0 ? <p className="text-sm text-tenue">{vacio}</p> : <ul className="divide-y divide-linea">{children}</ul>}
    </section>
  )
}

/** «Mi armario en números»: qué usas, qué compraste bien y qué sobra. */
export default function Estadisticas({ mostrarToast, onProponer, onCambio }) {
  const { prendas, cargando } = usePrendas()
  const hoy = isoLocal(new Date())

  const e = useMemo(() => (prendas ? estadisticasArmario(prendas, hoy) : null), [prendas, hoy])
  const huecos = useMemo(() => (prendas ? huecosDelArmario(prendas) : []), [prendas])

  async function cambiar(prenda, campos, mensaje) {
    vibrar(15)
    const antes = Object.fromEntries(Object.keys(campos).map((c) => [c, prenda[c] ?? (c === 'archivada' ? false : null)]))
    // Primero se pinta; si el servidor dice que no, se deshace solo.
    actualizarPrenda(prenda.id, campos)
    const { error } = await supabase.from('prendas').update(campos).eq('id', prenda.id)
    if (error) {
      actualizarPrenda(prenda.id, antes)
      return mostrarToast('No se pudo guardar.', 'error')
    }
    mostrarToast(mensaje, 'exito', {
      texto: 'Deshacer',
      onClick: async () => {
        actualizarPrenda(prenda.id, antes)
        const { error: errDeshacer } = await supabase.from('prendas').update(antes).eq('id', prenda.id)
        if (errDeshacer) {
          actualizarPrenda(prenda.id, campos)
          return mostrarToast('No se pudo deshacer', 'error')
        }
        onCambio?.()
      },
    })
    onCambio?.()
  }

  if (cargando) return <div className="flex flex-col gap-4"><h2 className="titulo-hoja">Mi armario en números</h2><div role="status" aria-label="Cargando" className="esqueleto h-48 w-full" /></div>

  if (e.total === 0 && e.archivadas.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h2 className="titulo-hoja">Mi armario en números</h2>
        <p className="text-tenue">Todavía no hay prendas. Añade unas cuantas y vuelve.</p>
      </div>
    )
  }

  const usos = (p) => `${numUsos(p)} ${numUsos(p) === 1 ? 'uso' : 'usos'}`
  const porUso = (p) => (costePorUso(p) === null ? 'Sin usar' : `${dinero(costePorUso(p))}/uso`)

  return (
    <div className="flex flex-col gap-6 text-left">
      <h2 className="titulo-hoja">Mi armario en números</h2>

      <div className="grid grid-cols-3 gap-2">
        {[['Prendas', e.total], ['Usos', e.usosTotales], ['Invertido', e.conPrecio ? dinero(e.inversion) : '—']].map(([etiqueta, valor]) => (
          <div key={etiqueta} className="rounded-xl bg-lamina p-3 text-center">
            <p className="text-xl font-semibold tabular-nums">{valor}</p>
            <p className="text-xs text-tenue">{etiqueta}</p>
          </div>
        ))}
      </div>
      {e.conPrecio > 0 && e.conPrecio < e.total && <p className="text-xs text-tenue -mt-4">Con precio: {e.conPrecio} de {e.total} prendas.</p>}

      {huecos.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="huecos-titulo">
          <h3 id="huecos-titulo" className="text-lg font-semibold">Huecos del armario</h3>
          <ul className="rounded-xl bg-lamina divide-y divide-linea px-3">
            {huecos.map((h) => (
              <li key={`${h.hueco}-${h.color}`} className="flex items-center gap-3 py-2.5">
                <span aria-hidden="true" className="w-5 h-5 shrink-0 rounded-full border border-linea" style={{ backgroundColor: h.hex }} />
                <p className="text-sm">
                  Con <span className="font-medium">{h.etiqueta}</span> ganas {h.ganancia} {h.ganancia === 1 ? 'combinación' : 'combinaciones'}.
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Bloque titulo="Lo que más te pones" vacio="Aún no has anotado ningún uso." hijos={e.masUsadas.length}>
        {e.masUsadas.map((p) => <Fila key={p.id} prenda={p} dato={usos(p)} />)}
      </Bloque>
      <Bloque titulo="Lo que menos te pones" vacio="Nada por aquí." hijos={e.menosUsadas.length}>
        {e.menosUsadas.map((p) => <Fila key={p.id} prenda={p} dato={usos(p)} />)}
      </Bloque>

      {e.conPrecio > 0 && (
        <>
          <Bloque titulo="Mejores compras" vacio="Anota precio y usos para verlas." hijos={e.mejores.length}>
            {e.mejores.map((p) => <Fila key={p.id} prenda={p} dato={porUso(p)} />)}
          </Bloque>
          <Bloque titulo="Peores compras" vacio="Nada por aquí." hijos={e.peores.length}>
            {e.peores.map((p) => <Fila key={p.id} prenda={p} dato={porUso(p)} />)}
          </Bloque>
        </>
      )}

      <GraficoBarras titulo="Por color" datos={e.porColor} colores={PUNTO_FAMILIA} />
      <GraficoBarras titulo="Por tipo" datos={e.porTipo} />
      <GraficoBarras titulo="Por temporada" datos={e.porTemporada} />

      <Bloque titulo="Sin usar en 90 días" vacio="Todo lo que tienes se mueve. Bien." hijos={e.olvidadas.length}>
        {e.olvidadas.map(({ prenda, dias }) => (
          <Fila key={prenda.id} prenda={prenda} dato={dias === null ? 'Nunca' : `${dias} días`}>
            <div className="flex gap-2 overflow-x-auto sin-barra mt-2 pb-1" role="group" aria-label={`Qué hacer con ${prenda.nombre}`}>
              <button onClick={() => onProponer(prenda.id)} className={`${chipAccion} bg-acento! text-sobre-acento! border-acento!`}>Proponme un outfit</button>
              <button onClick={() => cambiar(prenda, { salida: 'donar' }, 'Marcada para donar')} className={chipAccion}>Donar</button>
              <button onClick={() => cambiar(prenda, { salida: 'vender' }, 'Marcada para vender')} className={chipAccion}>Vender</button>
              <button onClick={() => cambiar(prenda, { archivada: true }, 'Prenda archivada')} className={chipAccion}>Archivar</button>
            </div>
          </Fila>
        ))}
      </Bloque>

      {e.paraSalir.length > 0 && (
        <Bloque titulo="Para donar o vender" hijos={e.paraSalir.length}>
          {e.paraSalir.map((p) => (
            <Fila key={p.id} prenda={p} dato={p.salida === 'donar' ? 'Donar' : 'Vender'}>
              <div className="flex gap-2 mt-2">
                <button onClick={() => cambiar(p, { salida: null }, 'Marca quitada')} className={chipAccion}>Me la quedo</button>
                <button onClick={() => cambiar(p, { archivada: true, salida: null }, 'Prenda archivada')} className={chipAccion}>Ya salió: archivar</button>
              </div>
            </Fila>
          ))}
        </Bloque>
      )}

      {e.archivadas.length > 0 && (
        <Bloque titulo="Archivadas" hijos={e.archivadas.length}>
          {e.archivadas.map((p) => (
            <Fila key={p.id} prenda={p} dato={usos(p)}>
              <div className="mt-2"><button onClick={() => cambiar(p, { archivada: false }, 'Prenda recuperada')} className={chipAccion}>Recuperar</button></div>
            </Fila>
          ))}
        </Bloque>
      )}
    </div>
  )
}
