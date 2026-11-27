import { useState } from 'react'
import { supabase } from '../supabase'

export default function NuevaContrasena({ onListo }) {
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)
  const [guardando, setGuardando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    const password = e.target.password.value
    const repetida = e.target.repetida.value
    setError('')

    if (password.length < 6) {
      setError('La contraseña necesita 6 caracteres como mínimo.')
      return
    }
    if (password !== repetida) {
      setError('Las dos contraseñas no coinciden.')
      return
    }

    setGuardando(true)
    const { error: fallo } = await supabase.auth.updateUser({ password })
    setGuardando(false)

    if (fallo) {
      setError(fallo.message || 'No se pudo cambiar la contraseña.')
      return
    }
    setListo(true)
    setTimeout(onListo, 1200)
  }

  return (
    <div className="min-h-dvh flex flex-col justify-center bg-papel text-tinta font-sans px-6 py-10 pt-safe pb-safe">
      <div className="w-full max-w-sm mx-auto">
        <p className="titular text-lg text-tenue">Perletta</p>
        <h1 className="titular text-3xl mt-2 mb-8">Nueva contraseña</h1>

        {listo ? (
          <p role="status" className="text-sm text-tenue">Contraseña cambiada. Entrando…</p>
        ) : (
          <form onSubmit={enviar} className="flex flex-col gap-4">
            <div>
              <label htmlFor="password" className="etiqueta">Contraseña nueva</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className="campo"
              />
            </div>
            <div>
              <label htmlFor="repetida" className="etiqueta">Repítela</label>
              <input
                id="repetida"
                name="repetida"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className="campo"
              />
            </div>

            {error && <p role="alert" className="aviso-error text-sm">{error}</p>}

            <button type="submit" disabled={guardando} className="boton boton-primario mt-2">
              {guardando ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
