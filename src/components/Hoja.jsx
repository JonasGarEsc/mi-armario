import { Suspense } from 'react'
import { useArrastrarHoja } from '../lib/useArrastrarHoja'
import Icono from './Icono'

/** Hoja inferior: velo, asa para arrastrar, cierre y el contenido que llega tarde. */
export default function Hoja({ hojaRef, visible, onCerrar, bloqueada, children }) {
  const asaRef = useArrastrarHoja(hojaRef, onCerrar, true)
  return (
    <div className="fixed inset-0 z-80 flex flex-col justify-end md:justify-center md:items-center md:p-6" inert={!!bloqueada}>
      <div onClick={onCerrar} className={`absolute inset-0 bg-velo transition-opacity duration-300 ease-ios ${visible ? 'opacity-100' : 'opacity-0'}`} />
      <div ref={hojaRef} tabIndex={-1} role="dialog" aria-modal="true" className={`relative w-full md:max-w-lg max-h-[92dvh] md:max-h-[88dvh] flex flex-col bg-superficie rounded-t-3xl md:rounded-3xl pb-safe transition-[translate,opacity] duration-300 ease-ios ${visible ? 'translate-y-0 opacity-100' : 'translate-y-full md:translate-y-4 md:opacity-0'}`}>
        <div ref={asaRef} className="shrink-0 h-7 flex items-center justify-center touch-none cursor-grab">
          <div className="w-10 h-1 rounded-full bg-linea md:hidden" />
        </div>
        <button onClick={onCerrar} aria-label="Cerrar" className="boton-icono absolute! top-4 right-3 z-10">
          <Icono nombre="cerrar" />
        </button>

        <div data-hoja-contenido className="min-h-0 overflow-y-auto overscroll-contain px-5 md:px-7 pt-1 pb-6">
          {/* Un solo Suspense: el asa, el velo y la X quedan fuera y siguen
              funcionando aunque el contenido de la hoja llegue tarde. */}
          <Suspense fallback={<div role="status" aria-label="Cargando" className="flex flex-col gap-4"><div className="esqueleto h-8 w-48" />{[0, 1, 2, 3].map(i => <div key={i} className="esqueleto h-18" />)}</div>}>
            {children}
          </Suspense>
        </div>
      </div>
    </div>
  )
}
