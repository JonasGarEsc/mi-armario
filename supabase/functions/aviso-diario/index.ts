// Supabase Edge Function: aviso de la mañana con la propuesta del día.
//
// La llama un cron cada hora con la cabecera x-cron-secreto. Elige las
// suscripciones cuya hora local (columna `zona`) coincide con la hora actual,
// propone una prenda de arriba y otra de abajo (o un vestido) y envía un Web
// Push. Usa la clave de servicio y filtra SIEMPRE las prendas por el user_id
// de cada suscripción.
//
// Secretos: CRON_SECRETO, VAPID_PUBLICA, VAPID_PRIVADA y VAPID_CONTACTO.
// Despliegue: supabase functions deploy aviso-diario --no-verify-jwt
// (la autenticación la hace la cabecera secreta, no el JWT).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'
import {
  elegirPropuesta,
  endpointPushValido,
  fechaLocal,
  horaLocal,
  textoPropuesta,
} from './seleccion.js'

const ESPERA_CLIMA_MS = 5000
const CAMPOS_PRENDA = 'id, nombre, temporada, abrigo, archivada, deseada, categorias(nombre, tipos(nombre))'

type Suscripcion = {
  endpoint: string
  user_id: string
  p256dh: string
  auth: string
  hora: number
  zona: string
  lat: number | null
  lon: number | null
  ultimo_envio: string | null
}

type Prenda = {
  id: string
  nombre: string
  temporada: string[] | null
  abrigo: number | null
  archivada: boolean
  deseada: boolean
  categorias?: { nombre?: string | null; tipos?: { nombre?: string | null } | null } | null
}

const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

/** Compara la cabecera con el secreto sin filtrar el tiempo por longitud. */
async function igualesEnTiempoConstante(recibido: string, esperado: string): Promise<boolean> {
  const codificador = new TextEncoder()
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', codificador.encode(recibido)),
    crypto.subtle.digest('SHA-256', codificador.encode(esperado)),
  ])
  const x = new Uint8Array(a)
  const y = new Uint8Array(b)
  let diferencia = 0
  for (let i = 0; i < x.length; i++) diferencia |= x[i] ^ y[i]
  return diferencia === 0
}

/** Tiempo actual con Open-Meteo. Sin coordenadas o sin respuesta, null. */
async function climaDe(lat: number | null, lon: number | null): Promise<{ temp: number; lluvia: boolean } | null> {
  if (typeof lat !== 'number' || typeof lon !== 'number') return null
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'apparent_temperature,precipitation',
      timezone: 'auto',
    })
    const respuesta = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: AbortSignal.timeout(ESPERA_CLIMA_MS),
    })
    if (!respuesta.ok) return null
    const datos = await respuesta.json()
    const temp = datos?.current?.apparent_temperature
    if (typeof temp !== 'number') return null
    return { temp, lluvia: (datos?.current?.precipitation ?? 0) >= 0.5 }
  } catch {
    return null
  }
}

/** Prendas disponibles de una cuenta. El filtro por user_id no se quita nunca. */
async function cargarPrendas(supabase: ReturnType<typeof createClient>, userId: string): Promise<Prenda[]> {
  const { data, error } = await supabase
    .from('prendas')
    .select(CAMPOS_PRENDA)
    .eq('user_id', userId)
    .eq('archivada', false)
    .eq('deseada', false)
    .limit(500)
  return error ? [] : ((data ?? []) as Prenda[])
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405)

  const secreto = Deno.env.get('CRON_SECRETO')
  if (!secreto) return responder({ error: 'Falta el secreto CRON_SECRETO' }, 503)
  if (!(await igualesEnTiempoConstante(req.headers.get('x-cron-secreto') ?? '', secreto))) {
    return responder({ error: 'No autorizado' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const claveServicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const vapidPublica = Deno.env.get('VAPID_PUBLICA')
  const vapidPrivada = Deno.env.get('VAPID_PRIVADA')
  const vapidContacto = Deno.env.get('VAPID_CONTACTO')
  if (!supabaseUrl || !claveServicio || !vapidPublica || !vapidPrivada || !vapidContacto) {
    return responder({ error: 'Faltan secretos de Supabase o de VAPID' }, 503)
  }

  webpush.setVapidDetails(vapidContacto, vapidPublica, vapidPrivada)
  const supabase = createClient(supabaseUrl, claveServicio)

  const { data, error } = await supabase
    .from('avisos_push')
    .select('endpoint, user_id, p256dh, auth, hora, zona, lat, lon, ultimo_envio')
  if (error) return responder({ error: error.message }, 500)

  const ahora = new Date()
  let enviados = 0
  let saltados = 0
  let borrados = 0
  let fallos = 0

  for (const suscripcion of (data ?? []) as Suscripcion[]) {
    if (horaLocal(ahora, suscripcion.zona) !== suscripcion.hora) continue
    const hoy = fechaLocal(ahora, suscripcion.zona)
    if (!hoy || suscripcion.ultimo_envio === hoy) continue
    if (!endpointPushValido(suscripcion.endpoint)) {
      saltados++
      continue
    }

    const prendas = await cargarPrendas(supabase, suscripcion.user_id)
    const clima = await climaDe(suscripcion.lat, suscripcion.lon)
    const texto = textoPropuesta(elegirPropuesta(prendas, clima, hoy), clima)
    if (!texto) {
      saltados++
      continue
    }

    // Reserva atómica del día: si dos cron coinciden, solo una actualización
    // devuelve la fila y solo esa envía. Se marca antes de enviar.
    const { data: reservada } = await supabase
      .from('avisos_push')
      .update({ ultimo_envio: hoy })
      .eq('endpoint', suscripcion.endpoint)
      .or(`ultimo_envio.is.null,ultimo_envio.neq.${hoy}`)
      .select('endpoint')
    if (!reservada?.length) {
      saltados++
      continue
    }

    try {
      await webpush.sendNotification(
        { endpoint: suscripcion.endpoint, keys: { p256dh: suscripcion.p256dh, auth: suscripcion.auth } },
        JSON.stringify({ title: texto.titulo, body: texto.cuerpo, url: '/?vista=hoy' }),
        { timeout: 10_000 },
      )
      enviados++
    } catch (fallo) {
      const codigo = (fallo as { statusCode?: number }).statusCode
      if (codigo === 404 || codigo === 410) {
        await supabase.from('avisos_push').delete().eq('endpoint', suscripcion.endpoint)
        borrados++
      } else {
        fallos++
      }
    }
  }

  return responder({ enviados, saltados, borrados, fallos })
})
