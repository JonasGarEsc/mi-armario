/** Filtro del armario por tipo y categoría, con acceso a sus gestores. */
export default function Filtros({ datosMenu, filtroActual, onAplicar, onAbrirTipos, onAbrirCategorias }) {
  const chip = (activo) => `min-h-11 px-4 rounded-full ${activo ? 'bg-acento text-sobre-acento font-semibold' : 'bg-lamina text-tinta'}`
  return (
    <div className="flex flex-col gap-5">
      <h2 className="titulo-hoja">Filtrar</h2>
      <button onClick={() => onAplicar(null)} aria-pressed={!filtroActual} className={`self-start ${chip(!filtroActual)}`}>Todo</button>
      {!datosMenu && <div role="status" aria-label="Cargando" className="flex gap-2">{[0, 1, 2].map(i => <div key={i} className="esqueleto h-11 w-24" />)}</div>}
      {datosMenu?.map(tipo => (
        <div key={tipo.id}>
          <h3 className="etiqueta">{tipo.nombre}</h3>
          <div className="flex flex-wrap items-center gap-2">
            {tipo.categorias.length === 0 && <span className="text-sm text-tenue">Sin prendas</span>}
            {tipo.categorias.map(cat => (
              <button key={cat.id} onClick={() => onAplicar(cat)} aria-pressed={filtroActual?.id === cat.id} className={chip(filtroActual?.id === cat.id)}>{cat.nombre}</button>
            ))}
          </div>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-linea">
        <button onClick={onAbrirTipos} className="boton boton-secundario">Tipos</button>
        <button onClick={onAbrirCategorias} className="boton boton-secundario">Categorías</button>
      </div>
    </div>
  )
}
