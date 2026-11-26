import { createClient } from '@supabase/supabase-js'

// Si pegan la URL del panel de Supabase viene con /rest/v1/ al final y el cliente
// acaba pidiendo /rest/v1//rest/v1/prendas. Se recorta aquí una vez.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '').replace(/\/rest\/v1$/, '')
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Sin estas dos variables la app reventaba al importar y dejaba la página en blanco.
export const configuracionFaltante = !supabaseUrl || !supabaseAnonKey

export const supabase = configuracionFaltante
  ? null
  : createClient(supabaseUrl, supabaseAnonKey)
