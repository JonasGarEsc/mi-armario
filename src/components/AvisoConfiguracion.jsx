export default function AvisoConfiguracion() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-papel font-sans">
      <div className="w-full max-w-md bg-superficie rounded-3xl p-6 space-y-3 text-tinta wrap-break-word">
        <h1 className="text-xl font-bold text-peligro">Falta la conexión con Supabase</h1>
        <p>
          El build no encontró <code>VITE_SUPABASE_URL</code> ni <code>VITE_SUPABASE_ANON_KEY</code>.
        </p>
        <p>
          En local, revisa el archivo de variables de entorno de la raíz del proyecto. En Vercel,
          añádelas en Settings → Environment Variables y vuelve a desplegar.
        </p>
      </div>
    </div>
  )
}
