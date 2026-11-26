import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LimiteErrores from './components/LimiteErrores.jsx'
import AvisoConfiguracion from './components/AvisoConfiguracion.jsx'
import { configuracionFaltante } from './supabase.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LimiteErrores>
      {configuracionFaltante ? <AvisoConfiguracion /> : <App />}
    </LimiteErrores>
  </StrictMode>,
)
