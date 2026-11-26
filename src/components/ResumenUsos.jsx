import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

// Resumen mínimo del registro de uso, dentro de Ajustes.
export default function ResumenUsos() {
  const [resumen, setResumen] = useState(null)

  useEffect(() => {
    let vivo = true
    supabase
      .from('usos')
      .select('prenda_id, prendas(nombre)')
      .then(({ data }) => {
        if (!vivo) return
        if (!data) {
          setResumen(null)
          return
        }
        const cuenta = new Map()
        data.forEach((uso) => {
          const nombre = uso.prendas?.nombre || 'Sin nombre'
          cuenta.set(nombre, (cuenta.get(nombre) || 0) + 1)
        })
        const top = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]
        setResumen({ total: data.length, top })
      })
    return () => { vivo = false }
  }, [])

  if (!resumen) return null

  return (
    <p className="text-sm text-tenue">
      {resumen.total === 0
        ? 'Aún no has anotado ningún uso.'
        : `${resumen.total} ${resumen.total === 1 ? 'uso anotado' : 'usos anotados'}${resumen.top ? ` · Lo que más: ${resumen.top[0]} (${resumen.top[1]})` : ''}.`}
    </p>
  )
}
