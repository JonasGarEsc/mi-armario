import { useRef, useState } from 'react'
import { supabase } from '../supabase'

const MENSAJES = {
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Email not confirmed': 'La cuenta no está confirmada. Confírmala desde Supabase.',
  'Failed to fetch': 'No hay conexión con el servidor.',
  'Email rate limit exceeded': 'Demasiados intentos. Espera un minuto.',
  'Email logins are disabled': 'El acceso por correo está desactivado en Supabase.',
  'Invalid API key': 'La clave de Supabase no vale para este proyecto.',
  'User already registered': 'Ese correo ya tiene cuenta. Entra directamente.',
  'Password should be at least 6 characters': 'La contraseña necesita 6 caracteres como mínimo.',
}

export default function Acceso() {
  const [modo, setModo] = useState('entrar')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)
  const emailRef = useRef(null)

  async function enviar(e) {
    e.preventDefault()
    if (enviando) return
    setEnviando(true)
    setError('')
    setAviso('')

    const email = e.target.email.value.trim()
    const password = e.target.password.value

    if (modo === 'entrar') {
      const { error: fallo } = await supabase.auth.signInWithPassword({ email, password })
      // Si sale bien, App cambia de pantalla sola con el aviso de sesión.
      if (fallo) setError(MENSAJES[fallo.message] || 'No se pudo entrar. Inténtalo otra vez.')
      setEnviando(false)
      return
    }

    const { data, error: fallo } = await supabase.auth.signUp({ email, password })
    if (fallo) setError(MENSAJES[fallo.message] || 'No se pudo crear la cuenta. Inténtalo otra vez.')
    // Con la confirmación por correo activa no hay sesión hasta que se confirme.
    else if (!data.session) setAviso('Cuenta creada. Revisa tu correo para confirmarla y luego entra.')
    setEnviando(false)
  }

  function cambiarModo() {
    setModo(modo === 'entrar' ? 'crear' : 'entrar')
    setError('')
    setAviso('')
  }

  async function recuperar() {
    const email = emailRef.current?.value.trim()
    if (!email) {
      setError('Escribe tu correo y pulsa otra vez.')
      setAviso('')
      emailRef.current?.focus()
      return
    }
    setEnviando(true)
    setError('')
    setAviso('')
    const { error: fallo } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    setEnviando(false)
    if (fallo) setError(MENSAJES[fallo.message] || 'No se pudo enviar el correo. Inténtalo otra vez.')
    else setAviso('Te hemos enviado un enlace para cambiar la contraseña. Mira tu correo.')
  }

  const creando = modo === 'crear'

  return (
    <div className="min-h-dvh flex flex-col justify-center bg-papel text-tinta font-sans px-6 py-10 pt-safe pb-safe">
      <div className="w-full max-w-sm mx-auto">
        <p className="titular text-lg text-tenue">Perletta</p>
        <h1 className="titular text-3xl mt-2 mb-8">
          {creando ? 'Tu armario, desde cero' : 'Tu armario, solo tuyo'}
        </h1>

        <form onSubmit={enviar} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="etiqueta">Correo</label>
            <input
              id="email"
              name="email"
              ref={emailRef}
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
              minLength={6}
              autoComplete={creando ? 'new-password' : 'current-password'}
              className="campo"
            />
          </div>

          {error && <p role="alert" className="aviso-error text-sm">{error}</p>}
          {aviso && <p role="status" className="text-sm text-tenue">{aviso}</p>}

          <button type="submit" disabled={enviando} className="boton boton-primario mt-2">
            {enviando ? (creando ? 'Creando…' : 'Entrando…') : (creando ? 'Crear cuenta' : 'Entrar')}
          </button>
        </form>

        <button onClick={cambiarModo} className="text-sm text-tenue mt-6 mx-auto underline hover:text-tinta">
          {creando ? '¿Ya tienes cuenta? Entrar' : '¿No tienes cuenta? Crear una'}
        </button>

        {!creando && (
          <button onClick={recuperar} disabled={enviando} className="block text-sm text-tenue mt-3 mx-auto underline hover:text-tinta">
            ¿Olvidaste la contraseña?
          </button>
        )}
      </div>
    </div>
  )
}
