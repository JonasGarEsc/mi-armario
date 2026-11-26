import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LimiteErrores from './components/LimiteErrores.jsx'
import { configuracionFaltante } from './supabase.js'

function AvisoConfiguracion() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-100">
      <div className="max-w-md bg-white rounded-2xl shadow p-6 space-y-3 text-slate-700">
        <h1 className="text-lg font-bold text-red-600">Falta la conexión con Supabase</h1>
        <p className="text-sm">
          El build no encontró <code>VITE_SUPABASE_URL</code> ni <code>VITE_SUPABASE_ANON_KEY</code>.
        </p>
        <p className="text-sm">
          En local, revisa el archivo de variables de entorno de la raíz del proyecto. En Vercel,
          añádelas en Settings → Environment Variables y vuelve a desplegar.
        </p>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LimiteErrores>
      {configuracionFaltante ? <AvisoConfiguracion /> : <App />}
    </LimiteErrores>
  </StrictMode>,
)
