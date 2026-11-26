import { lazy } from 'react'
import { ciudadGuardada, guardarCiudad } from '../lib/clima'
import { vibrar } from '../lib/vibrar'
import Icono from './Icono'

const AvisoDiario = lazy(() => import('./AvisoDiario'))
const EtiquetarArmario = lazy(() => import('./EtiquetarArmario'))
const ResumenUsos = lazy(() => import('./ResumenUsos'))

/** Ajustes del armario: tema, copia de seguridad, ciudad, avisos y sesión. */
export default function Ajustes({
  temaOscuro, onTema, onExportar, onRestaurar, sesion, onCerrarSesion,
  mostrarToast, onVerEstadisticas, onRecargar,
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="titulo-hoja mb-2">Ajustes</h2>
      <button role="switch" aria-checked={temaOscuro} onClick={() => { onTema(!temaOscuro); vibrar(30) }} className="boton boton-secundario justify-between!">
        Tema oscuro
        <span aria-hidden="true" className={`w-11 h-6 rounded-full p-0.5 ${temaOscuro ? 'bg-acento' : 'bg-tenue'}`}>
          <span className={`block w-5 h-5 rounded-full bg-superficie transition-transform duration-200 ${temaOscuro ? 'translate-x-5' : ''}`} />
        </span>
      </button>
      <button onClick={onExportar} className="boton boton-secundario justify-between!">
        Descargar copia de seguridad
        <Icono nombre="descargar" />
      </button>
      <label className="boton boton-secundario justify-between! cursor-pointer">
        Restaurar copia de seguridad
        <input type="file" accept=".json,application/json" onChange={onRestaurar} className="sr-only" />
        <Icono nombre="lista" />
      </label>
      <p className="text-sm text-tenue -mt-2">La copia se añade a lo que ya tienes; no borra nada. Las fotos no van dentro de la copia y solo se restaura bien en la misma cuenta (las fotos son privadas de cada cuenta).</p>
      <div>
        <label htmlFor="ciudadClima" className="etiqueta">Mi ciudad (para el tiempo de hoy)</label>
        <input id="ciudadClima" type="text" autoComplete="off" placeholder="Madrid" defaultValue={ciudadGuardada()} onBlur={(e) => guardarCiudad(e.target.value)} className="campo" />
        <p className="text-sm text-tenue mt-1">Se usa si no das permiso de ubicación.</p>
      </div>
      <AvisoDiario mostrarToast={mostrarToast} />
      <button onClick={onVerEstadisticas} className="boton boton-secundario justify-between!">
        Mi armario en números
        <Icono nombre="lista" />
      </button>
      <EtiquetarArmario onTerminado={onRecargar} />
      <ResumenUsos />
      <div className="pt-3 mt-1 border-t border-linea">
        <p className="text-sm text-tenue mb-2 truncate">Sesión: {sesion.user?.email}</p>
        <button onClick={onCerrarSesion} className="boton boton-secundario w-full justify-between!">
          Cerrar sesión
          <Icono nombre="salir" />
        </button>
      </div>
      <p className="text-sm text-tenue pt-2">Perletta v3</p>
    </div>
  )
}
