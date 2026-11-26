/** Guarda un outfit nuevo dentro de una maleta. */
export default function FormularioConjunto({ maletas, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <h2 className="titulo-hoja">Guardar outfit</h2>
      <div>
        <label htmlFor="maletaId" className="etiqueta">Maleta</label>
        <select id="maletaId" name="maletaId" required className="campo">
          {maletas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="nombreConjunto" className="etiqueta">Nombre</label>
        <input id="nombreConjunto" type="text" name="nombreConjunto" autoComplete="off" required placeholder="Casual día 1" className="campo" />
      </div>
      <button type="submit" className="boton boton-primario mt-2">Guardar</button>
    </form>
  )
}
