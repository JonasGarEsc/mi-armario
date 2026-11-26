// Estados vacíos con un dibujo propio (sin imágenes ni fuentes externas) y una
// acción clara. Los trazos toman el color del tema; el acento marca un detalle.

const DIBUJOS = {
  percha: (
    <>
      <path d="M20 12h120" strokeDasharray="3 7" opacity=".45" />
      <path d="M80 36v-6a9 9 0 1 1 9 9" stroke="var(--acento)" />
      <path d="M80 36 44 61h72L80 36Z" fill="var(--lamina)" />
      <path d="M62 61h36l7 24H55l7-24Z" fill="var(--foto)" />
      <path d="M69 61v-5m22 5v-5" opacity=".6" />
    </>
  ),
  maleta: (
    <>
      <rect x="32" y="24" width="96" height="60" rx="12" fill="var(--lamina)" />
      <path d="M68 24v-4a8 8 0 0 1 8-8h8a8 8 0 0 1 8 8v4" />
      <path d="M32 46h96" stroke="var(--acento)" />
      <path d="M52 24v60m56-60v60" opacity=".45" />
      <path d="M71 58h18" />
      <path d="M120 38l12 4v12l-12 5V38Z" fill="var(--lamina)" />
    </>
  ),
  calendario: (
    <>
      <rect x="30" y="20" width="100" height="70" rx="12" fill="var(--lamina)" />
      <path d="M30 38h100" />
      <path d="M52 12v14m56-14v14" />
      <path d="M48 52h6m10 0h6m10 0h6m10 0h6m10 0h6M48 66h6m10 0h6m10 0h6m10 0h6m10 0h6M48 80h6m10 0h6" opacity=".55" />
      <circle cx="98" cy="66" r="6" fill="var(--acento)" stroke="none" />
    </>
  ),
  lista: (
    <>
      <rect x="42" y="12" width="76" height="78" rx="10" fill="var(--lamina)" />
      <path d="M58 30h30M58 44h30M58 58h18" />
      <circle cx="52" cy="30" r="2.4" fill="var(--acento)" stroke="none" />
      <circle cx="52" cy="44" r="2.4" fill="var(--acento)" stroke="none" />
      <path d="M96 58l7 7 14-14" stroke="var(--acento)" strokeWidth="3" />
    </>
  ),
}

export default function EstadoVacio({ dibujo = 'percha', titulo, texto, accionTexto, onAccion, className = '' }) {
  return (
    <div className={`flex-1 flex flex-col items-center justify-center gap-3 py-12 text-center ${className}`}>
      <svg
        viewBox="0 0 160 96"
        className="w-36 h-24 text-tenue"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {DIBUJOS[dibujo] || DIBUJOS.percha}
      </svg>
      <p className="titular text-xl text-tinta">{titulo}</p>
      {texto && <p className="text-tenue max-w-xs">{texto}</p>}
      {onAccion && accionTexto && (
        <button onClick={onAccion} className="boton boton-primario mt-2">{accionTexto}</button>
      )}
    </div>
  )
}
