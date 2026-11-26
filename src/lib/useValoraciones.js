import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { cargarValoraciones, conValoracion, guardarValoracion, siguienteValor } from './valoraciones'

/**
 * Valoraciones del usuario con actualización optimista.
 * `valoraciones` es null mientras carga.
 */
export function useValoraciones() {
  const [mapa, setMapa] = useState(null)
  const mapaRef = useRef(null)

  useEffect(() => {
    let vivo = true
    cargarValoraciones(supabase).then((cargadas) => {
      if (!vivo) return
      mapaRef.current = cargadas
      setMapa(cargadas)
    })
    return () => { vivo = false }
  }, [])

  const valorar = useCallback(async (clave, elegido, avisar) => {
    const actual = mapaRef.current
    if (!actual || !clave) return
    const anterior = actual.get(clave) ?? 0
    const nuevo = siguienteValor(anterior, elegido)
    const siguiente = conValoracion(actual, clave, nuevo)
    mapaRef.current = siguiente
    setMapa(siguiente)

    const r = await guardarValoracion(supabase, clave, nuevo)
    if (r.ok) return
    // Vuelta atrás solo de esta clave, sin pisar otros cambios.
    const vuelta = conValoracion(mapaRef.current, clave, anterior)
    mapaRef.current = vuelta
    setMapa(vuelta)
    avisar?.('No se pudo guardar la valoración')
  }, [])

  return { valoraciones: mapa, cargando: mapa === null, valorar }
}
