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
  return primero
    ? { lat: primero.latitude, lon: primero.longitude, nombre: primero.name, pais: primero.country_code || null }
    : null
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
export async function climaDeHoy({ ciudad = ciudadGuardada(), forzar = false, sinRed = false } = {}) {
  if (!forzar) {
    try {
      const guardado = JSON.parse(leerLocal(CLAVE_CACHE))
      if (guardado && Date.now() - guardado.cuando < VALIDEZ_MS && guardado.ciudad === ciudad) return guardado.valor
    } catch { /* sin caché válida */ }
  }

  // Sin conexión no se pide ubicación ni previsión: solo vale lo guardado.
  if (sinRed) return null

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

// --- Previsión de un viaje ---------------------------------------------------

const DIAS_PREVISION = 15 // hasta dónde llega la previsión de Open-Meteo

function sumarDias(iso, dias) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10)
}

/** Mismo día un año antes (el 29 de febrero pasa al 28). */
export function mismoDiaAnioAnterior(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const f = new Date(Date.UTC(y - 1, m - 1, d))
  if (f.getUTCMonth() !== m - 1) f.setUTCDate(0)
  return f.toISOString().slice(0, 10)
}

/** Qué fuente usar para cada día: la previsión o la media del año anterior. */
export function fuenteDelDia(fechaISO, hoyISO) {
  const desde = sumarDias(hoyISO, -1)
  const hasta = sumarDias(hoyISO, DIAS_PREVISION)
  if (fechaISO >= desde && fechaISO <= hasta) return { fuente: 'prevision', fecha: fechaISO }
  return { fuente: 'historico', fecha: fechaISO < desde ? fechaISO : mismoDiaAnioAnterior(fechaISO) }
}

/** Todos los días de una respuesta diaria, como { fecha, temp, min, max, lluvia }. */
export function resumenesDiarios(json) {
  const tiempos = json?.daily?.time
  if (!Array.isArray(tiempos)) return []
  return tiempos
    .map((fecha, i) => ({ fecha, ...resumenClima(json, i) }))
    .filter((d) => typeof d.temp === 'number')
}

async function pedirRango(base, { lat, lon }, desde, hasta, diario) {
  const params = new URLSearchParams({ latitude: lat, longitude: lon, daily: diario, timezone: 'auto', start_date: desde, end_date: hasta })
  const r = await fetch(`${base}?${params}`)
  return resumenesDiarios(await r.json())
}

/**
 * Tiempo previsto, día a día, del destino de una maleta. Hasta 15 días vista usa la
 * previsión; más allá, o en el pasado, la media del mismo día del año anterior
 * (`estimado: true`, para avisar de que es orientativo).
 * Devuelve { dias, nombre, pais } o null si el destino no existe o falla la red.
 */
export async function previsionViaje({ destino, fechas, hoy }) {
  try {
    const sitio = await coordenadasDeCiudad(destino)
    if (!sitio || fechas.length === 0) return null

    const dias = new Map()
    const pedir = async (fuente, desde, hasta) => {
      const lista = fuente === 'prevision'
        ? await pedirRango('https://api.open-meteo.com/v1/forecast', sitio, desde, hasta,
          'apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,precipitation_sum')
        : await pedirRango('https://archive-api.open-meteo.com/v1/archive', sitio, desde, hasta,
          'apparent_temperature_max,apparent_temperature_min,precipitation_sum')
      return new Map(lista.map((d) => [d.fecha, d]))
    }

    // Se piden de una vez los días de cada fuente (un rango por fuente).
    const plan = fechas.map((f) => ({ ...fuenteDelDia(f, hoy), original: f }))
    for (const fuente of ['prevision', 'historico']) {
      const suyos = plan.filter((p) => p.fuente === fuente)
      if (suyos.length === 0) continue
      const ordenadas = suyos.map((p) => p.fecha).sort()
      const respuesta = await pedir(fuente, ordenadas[0], ordenadas[ordenadas.length - 1])
      for (const p of suyos) {
        const d = respuesta.get(p.fecha)
        if (d) dias.set(p.original, { ...d, fecha: p.original, estimado: fuente === 'historico' })
      }
    }

    const lista = fechas.map((f) => dias.get(f)).filter(Boolean)
    return lista.length ? { dias: lista, nombre: sitio.nombre, pais: sitio.pais } : null
  } catch {
    return null
  }
}

/** País de casa (dos letras) a partir del idioma del dispositivo; ES si no se sabe. */
export function paisDeCasa(idioma = typeof navigator !== 'undefined' ? navigator.language : '') {
  const region = String(idioma || '').split('-')[1]
  return /^[A-Za-z]{2}$/.test(region || '') ? region.toUpperCase() : 'ES'
}
