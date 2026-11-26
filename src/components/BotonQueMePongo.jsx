import Icono from './Icono'

export default function BotonQueMePongo({ onClick, className = '' }) {
  return (
    <button onClick={onClick} className={`boton boton-primario w-full md:w-auto ${className}`}>
      <Icono nombre="percha" className="w-5 h-5" />
      ¿Qué me pongo hoy?
    </button>
  )
}
