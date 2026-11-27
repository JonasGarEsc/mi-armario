/** Confirmación global en cascada: se pinta por encima de la hoja abierta. */
export default function DialogoGlobal({ dialogo, onCerrar }) {
  return (
    <div className="fixed inset-0 bg-velo z-200 flex items-center justify-center p-4">
      <div role="alertdialog" aria-modal="true" aria-labelledby="titulo-dialogo" className="aparece bg-superficie rounded-3xl p-5 w-full max-w-sm max-h-full overflow-y-auto">
        <h3 id="titulo-dialogo" className="text-xl font-semibold leading-snug mb-5 min-w-0 wrap-break-word">{dialogo.mensaje}</h3>
        {dialogo.contenidoAdicional}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              const fn = dialogo.onConfirm;
              onCerrar();
              if(fn) fn();
            }}
            className={`boton w-full ${dialogo.esDestructivo ? 'boton-peligro' : 'boton-primario'}`}
          >
            {dialogo.textoConfirmar || 'Confirmar'}
          </button>
          <button autoFocus onClick={onCerrar} className="boton boton-secundario w-full">Cancelar</button>
        </div>
      </div>
    </div>
  )
}
