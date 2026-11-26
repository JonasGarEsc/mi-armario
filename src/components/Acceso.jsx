import { useState } from 'react'
import { supabase } from '../supabase'

const MENSAJES = {
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Email not confirmed': 'La cuenta no está confirmada. Confírmala desde Supabase.',
  'Failed to fetch': 'No hay conexión con el servidor.',
  'Email rate limit exceeded': 'Demasiados intentos. Espera un minuto.',
  'Email logins are disabled': 'El acceso por correo está desactivado en Supabase.',
  'Invalid API key': 'La clave de Supabase no vale para este proyecto.',
}

export default function Acceso() {
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    if (enviando) return
    setEnviando(true)
    setError('')
    const { error: fallo } = await supabase.auth.signInWithPassword({
      email: e.target.email.value.trim(),
      password: e.target.password.value,
    })
    // Si sale bien, App cambia de pantalla sola con el aviso de sesión.
    if (fallo) {
      setError(MENSAJES[fallo.message] || 'No se pudo entrar. Inténtalo otra vez.')
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col justify-center bg-papel text-tinta font-sans px-6 py-10 pt-safe pb-safe">
      <div className="w-full max-w-sm mx-auto">
        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-tenue">Perletta</p>
        <h1 className="text-3xl font-bold tracking-tight mt-2 mb-8">Tu armario, solo tuyo.</h1>

        <form onSubmit={entrar} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="etiqueta">Correo</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              className="campo"
            />
          </div>
          <div>
            <label htmlFor="password" className="etiqueta">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="campo"
            />
          </div>

          {error && <p role="alert" className="aviso-error text-sm">{error}</p>}

          <button type="submit" disabled={enviando} className="boton boton-primario mt-2">
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="text-sm text-tenue mt-6">
          Solo hay una cuenta. Si todavía no existe, se crea desde Supabase; los pasos están en el README.
        </p>
      </div>
    </div>
  )
}
