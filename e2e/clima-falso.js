// Respuestas inventadas de Open-Meteo para que la prueba no salga a internet.
// Devuelve el mismo formato diario que lee src/lib/clima.js.

const DESTINOS = {
  madrid: { latitude: 40.4168, longitude: -3.7038, name: 'Madrid', country_code: 'ES' },
  paris: { latitude: 48.8566, longitude: 2.3522, name: 'París', country_code: 'FR' },
  parís: { latitude: 48.8566, longitude: 2.3522, name: 'París', country_code: 'FR' },
  'san sebastian': { latitude: 43.3183, longitude: -1.9812, name: 'San Sebastián', country_code: 'ES' },
}

function sumarDias(iso, dias) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10)
}

function isoHoy() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Clima inventado para cualquier URL de Open-Meteo. */
export function climaFalso(urlTexto) {
  const url = new URL(urlTexto)
  if (url.hostname.startsWith('geocoding-api')) {
    const buscado = String(url.searchParams.get('name') || '').toLowerCase()
    const destino = DESTINOS[buscado] || DESTINOS.madrid
    return { results: [{ ...destino, country: destino.country_code === 'FR' ? 'Francia' : 'España', admin1: '' }] }
  }

  const hoy = isoHoy()
  const desde = url.searchParams.get('start_date') || hoy
  const hasta = url.searchParams.get('end_date') || desde
  const dias = []
  let fecha = desde
  let i = 0
  while (fecha <= hasta && i < 40) {
    dias.push(fecha)
    fecha = sumarDias(fecha, 1)
    i++
  }
  const templado = url.hostname.startsWith('archive-api')
  return {
    latitude: 48.85,
    longitude: 2.35,
    timezone: 'Europe/Madrid',
    daily: {
      time: dias,
      apparent_temperature_max: dias.map((_, n) => (templado ? 21 : 24 - (n % 4))),
      apparent_temperature_min: dias.map((_, n) => (templado ? 13 : 15 - (n % 3))),
      precipitation_probability_max: dias.map(() => 10),
      precipitation_sum: dias.map(() => 0),
    },
  }
}
