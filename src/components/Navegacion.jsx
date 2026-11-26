import { useSeccionVisual } from '../lib/seccionVisual'
import { SECCIONES } from '../lib/secciones'
import Icono from './Icono'

// La barra de pestañas y el título leen la sección visible por su cuenta:
// al deslizar se actualizan solos, sin re-renderizar el armario entero.
export function TituloSeccion({ respaldo }) {
  const activa = useSeccionVisual(respaldo)
  return SECCIONES.find(s => s.id === activa)?.nombre ?? null
}

export function BarraSecciones({ respaldo, onIr, onHoy }) {
  const activa = useSeccionVisual(respaldo)
  return (
    <nav aria-label="Secciones" className="md:hidden shrink-0 bg-superficie border-t border-linea pb-safe">
      <div className="grid grid-cols-4">
        <button onClick={onHoy} className="h-16 flex flex-col items-center justify-center gap-0.5 text-sm text-tenue">
          <Icono nombre="sol" />
          Hoy
        </button>
        {SECCIONES.map(s => (
          <button key={s.id} onClick={() => onIr(s.id)} aria-current={activa === s.id ? 'page' : undefined} className={`h-16 flex flex-col items-center justify-center gap-0.5 text-sm ${activa === s.id ? 'text-acento font-semibold' : 'text-tenue'}`}>
            <Icono nombre={s.icono} />
            {s.nombre}
          </button>
        ))}
      </div>
    </nav>
  )
}

export function NavegacionEscritorio({ activa, onIr, onHoy }) {
  return (
    <nav aria-label="Secciones" className="hidden md:flex gap-1 mr-auto ml-6">
      <button onClick={onHoy} className="min-h-11 px-4 rounded-xl font-medium text-tenue hover:text-tinta">Hoy</button>
      {SECCIONES.map(s => (
        <button key={s.id} onClick={() => onIr(s.id)} aria-current={activa === s.id ? 'page' : undefined} className={`min-h-11 px-4 rounded-xl font-medium ${activa === s.id ? 'bg-lamina text-tinta' : 'text-tenue hover:text-tinta'}`}>
          {s.nombre}
        </button>
      ))}
    </nav>
  )
}
