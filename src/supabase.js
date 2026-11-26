import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Sin estas dos variables la app reventaba al importar y dejaba la página en blanco.
export const configuracionFaltante = !supabaseUrl || !supabaseAnonKey

export const supabase = configuracionFaltante
  ? null
  : createClient(supabaseUrl, supabaseAnonKey)
