const estilo = (activo) =>
  `min-h-11 px-3 rounded-full text-sm font-medium ${activo ? 'bg-acento text-sobre-acento' : 'bg-lamina text-tinta'}`

/** Me gusta / no me gusta de una propuesta. Tocar el mismo botón la quita. */
export default function BotonesValoracion({ valor = 0, onValorar, etiqueta = '', className = '' }) {
  return (
    <div role="group" aria-label={etiqueta ? `Valorar ${etiqueta}` : 'Valorar propuesta'} className={`flex gap-2 ${className}`}>
      <button type="button" onClick={() => onValorar(1)} aria-pressed={valor === 1} className={estilo(valor === 1)}>
        Me gusta
      </button>
      <button type="button" onClick={() => onValorar(-1)} aria-pressed={valor === -1} className={estilo(valor === -1)}>
        No me gusta
      </button>
    </div>
  )
}
