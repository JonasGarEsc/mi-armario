import { useEffect, useState } from 'react'
import { desdeISO, etiquetaFechaCorta, isoLocal } from '../lib/fechas'

/** Previsión del destino de la maleta para sus fechas, si ya está a menos de 15 días. */
export default function WidgetClima({ maleta }) {
  const [clima, setClima] = useState(null)
  const [cargando, setCargando] = useState(true)
  const destino = (maleta?.destino || maleta?.nombre || '').replace(/[0-9]/g, '').trim()
  const inicio = maleta?.fecha_inicio
  const fin = maleta?.fecha_fin

  useEffect(() => {
    let montado = true

    async function obtenerClima() {
      setCargando(true)
      setClima(null)
      if (!destino || destino.length < 3) {
        setCargando(false)
        return
      }

      const hoy = new Date()
      const tope = new Date()
      tope.setDate(tope.getDate() + 15)

      let desde = hoy
      let hasta = hoy
      if (inicio) {
        desde = desdeISO(inicio)
        hasta = fin ? desdeISO(fin) : desde
        if (desde > tope) {
          if (montado) {
            setClima({ futuro: true })
            setCargando(false)
          }
          return
        }
        if (hasta > tope) hasta = tope
      }

      try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destino)}&count=1&language=es&format=json`)
        const geoData = await geoRes.json()
        if (!geoData.results?.length) return

        const { latitude, longitude, name } = geoData.results[0]
        const params = new URLSearchParams({
          latitude,
          longitude,
          daily: 'temperature_2m_max,temperature_2m_min',
          timezone: 'auto',
          start_date: isoLocal(desde),
          end_date: isoLocal(hasta),
        })
        const tiempoRes = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
        const tiempo = await tiempoRes.json()
        if (!tiempo.daily?.time?.length) return

        const i = Math.max(0, tiempo.daily.time.indexOf(isoLocal(desde)))
        if (montado) {
          setClima({
            nombre: name,
            fecha: tiempo.daily.time[i],
            max: tiempo.daily.temperature_2m_max[i],
            min: tiempo.daily.temperature_2m_min[i],
          })
        }
      } catch {
        // Sin previsión no pasa nada: la línea se queda vacía.
      }
      if (montado) setCargando(false)
    }

    obtenerClima()
    return () => { montado = false }
  }, [destino, inicio, fin])

  // La línea mide lo mismo cargando, sin dato y con dato: nada salta al llegar el clima.
  return (
    <div className="h-6 flex items-center text-sm text-tenue">
      {cargando ? (
        <div className="esqueleto h-3 w-40" />
      ) : clima?.futuro ? (
        <p className="truncate">La previsión llegará más cerca de la fecha.</p>
      ) : clima ? (
        <p className="truncate">
          {clima.nombre}: {etiquetaFechaCorta(clima.fecha)} · máx {Math.round(clima.max)}°, mín {Math.round(clima.min)}°
        </p>
      ) : null}
    </div>
  )
}
