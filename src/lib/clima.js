// Tiempo de hoy (Open-Meteo, sin clave) para «¿Qué me pongo hoy?».

const CLAVE_CIUDAD = 'armario_ciudad'
const CLAVE_CACHE = 'armario_clima_hoy'
const VALIDEZ_MS = 30 * 60 * 1000

/** Temperatura sentida del día y si va a llover, a partir de la respuesta diaria. */
export function resumenClima(json, indice = 0) {
  const d = json?.daily
  const max = d?.apparent_temperature_max?.[indice]
  const min = d?.apparent_temperature_min?.[indice]
  if (typeof max !== 'number' || typeof min !== 'number') return null
  const probabilidad = d.precipitation_probability_max?.[indice] ?? 0
  const suma = d.precipitation_sum?.[indice] ?? 0
  return {
    // Durante el día pesa más la máxima que la mínima de madrugada.
    temp: Math.round((max * 0.6 + min * 0.4) * 10) / 10,
    min: Math.round(min),
    max: Math.round(max),
    lluvia: probabilidad >= 50 || suma >= 1.5,
  }
}

function leerLocal(clave) {
  try { return localStorage.getItem(clave) } catch { return null }
}
function escribirLocal(clave, valor) {
  try { localStorage.setItem(clave, valor) } catch { /* modo privado: no pasa nada */ }
}

export const ciudadGuardada = () => leerLocal(CLAVE_CIUDAD) || ''
export const guardarCiudad = (ciudad) => escribirLocal(CLAVE_CIUDAD, String(ciudad || '').trim())

/** Ubicación del dispositivo, o null si no hay permiso, soporte o tarda demasiado. */
export function pedirUbicacion(esperaMs = 8000) {
  return new Promise((resolver) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolver(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolver({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolver(null),
      { timeout: esperaMs, maximumAge: 30 * 60 * 1000 },
    )
  })
}

export async function coordenadasDeCiudad(ciudad) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ciudad)}&count=1&language=es&format=json`)
  const datos = await r.json()
  const primero = datos.results?.[0]
  return primero ? { lat: primero.latitude, lon: primero.longitude, nombre: primero.name } : null
}

async function pedirClima({ lat, lon }) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    daily: 'apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,precipitation_sum',
    timezone: 'auto',
    forecast_days: 1,
  })
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  return resumenClima(await r.json())
}

/**
 * Tiempo de hoy: primero con la ubicación del dispositivo y, si no hay permiso,
 * con la ciudad guardada en Ajustes. Se guarda 30 min para no repetir la petición.
 * Devuelve { clima, origen, ciudad } o null si no se ha podido saber.
 */
export async function climaDeHoy({ ciudad = ciudadGuardada(), forzar = false } = {}) {
  if (!forzar) {
    try {
      const guardado = JSON.parse(leerLocal(CLAVE_CACHE))
      if (guardado && Date.now() - guardado.cuando < VALIDEZ_MS && guardado.ciudad === ciudad) return guardado.valor
    } catch { /* sin caché válida */ }
  }

  try {
    let sitio = await pedirUbicacion()
    let origen = 'ubicacion'
    let nombre = ''
    if (!sitio && ciudad) {
      const c = await coordenadasDeCiudad(ciudad)
      if (c) { sitio = c; origen = 'ciudad'; nombre = c.nombre }
    }
    if (!sitio) return null
    const clima = await pedirClima(sitio)
    if (!clima) return null
    const valor = { clima, origen, ciudad: nombre }
    escribirLocal(CLAVE_CACHE, JSON.stringify({ cuando: Date.now(), ciudad, valor }))
    return valor
  } catch {
    return null
  }
}
