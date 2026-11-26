// Avisos push de la propuesta del día.
//
// API para la interfaz:
//   soportado()                 → boolean. Sin VITE_VAPID_PUBLICA, en un
//                                 navegador sin Push o en iOS sin instalar, false.
//   estado()                    → Promise<{ soportado, permiso, suscrito, motivo }>.
//                                 `motivo` explica en español por qué no se puede.
//   activar(supabase, { hora, lat, lon })
//                               → Promise<{ ok, motivo? }>. Pide permiso, se
//                                 suscribe y guarda la suscripción en avisos_push.
//   desactivar(supabase)        → Promise<{ ok, motivo? }>. Borra la fila y la
//                                 suscripción del navegador.
//
// La clave pública se configura en Vercel como VITE_VAPID_PUBLICA. La privada
// vive solo como secreto de la Edge Function aviso-diario.

const CLAVE_PUBLICA = import.meta.env?.VITE_VAPID_PUBLICA || ''
const HORA_POR_DEFECTO = 8

/** ¿Se puede activar en este navegador? */
export function soportado() {
  return Boolean(
    CLAVE_PUBLICA &&
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'PushManager' in window &&
    navigator.serviceWorker &&
    !(esIOS() && !instalada()),
  )
}

/** Por qué no se puede activar, para enseñarlo tal cual en Ajustes. */
export function motivoSinSoporte() {
  if (!CLAVE_PUBLICA) return 'Faltan los avisos en esta instalación (VITE_VAPID_PUBLICA).'
  if (esIOS() && !instalada()) return 'En iPhone o iPad, añade Perletta a la pantalla de inicio para recibir avisos.'
  return 'Este navegador no admite avisos push.'
}

export function esIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** En iOS solo hay push si la app está instalada (pantalla de inicio). */
export function instalada() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.navigator.standalone === true
}

const permisoActual = () =>
  typeof Notification === 'undefined' ? 'default' : Notification.permission

/** Estado actual de los avisos. No pide permiso ni suscribe. */
export async function estado() {
  const base = { soportado: soportado(), permiso: permisoActual(), suscrito: false, motivo: null }
  if (!base.soportado) {
    base.motivo = motivoSinSoporte()
    return base
  }
  if (base.permiso === 'denied') {
    base.motivo = 'Las notificaciones están bloqueadas. Actívalas en los ajustes del navegador.'
    return base
  }
  try {
    const registro = await navigator.serviceWorker.ready
    base.suscrito = Boolean(await registro.pushManager.getSubscription())
  } catch {
    base.motivo = 'No se pudo consultar la suscripción a los avisos.'
  }
  return base
}

/** Clave VAPID (base64url) como bytes, que es lo que pide PushManager. */
export function decodificarClave(texto) {
  const limpio = String(texto || '').replace(/-/g, '+').replace(/_/g, '/')
  const relleno = '='.repeat((4 - (limpio.length % 4)) % 4)
  const binario = atob(limpio + relleno)
  return Uint8Array.from(binario, (c) => c.charCodeAt(0))
}

const zonaActual = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid' }
  catch { return 'Europe/Madrid' }
}

/**
 * Activa el aviso diario. `hora` es la hora local (0-23, por defecto 8).
 * `lat`/`lon` son opcionales: sin ellos, la propuesta no mira el tiempo.
 */
export async function activar(supabase, { hora = HORA_POR_DEFECTO, lat = null, lon = null } = {}) {
  if (!soportado()) return { ok: false, motivo: motivoSinSoporte() }
  if (!supabase) return { ok: false, motivo: 'Falta la conexión con Supabase.' }

  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') {
    return {
      ok: false,
      motivo: permiso === 'denied'
        ? 'Las notificaciones están bloqueadas. Actívalas en los ajustes del navegador.'
        : 'No se han concedido las notificaciones.',
    }
  }

  try {
    const registro = await navigator.serviceWorker.ready
    let suscripcion = await registro.pushManager.getSubscription()
    if (!suscripcion) {
      suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodificarClave(CLAVE_PUBLICA),
      })
    }

    const claves = suscripcion.toJSON().keys
    const { error } = await supabase.from('avisos_push').upsert({
      endpoint: suscripcion.endpoint,
      p256dh: claves.p256dh,
      auth: claves.auth,
      hora: Math.min(23, Math.max(0, Math.trunc(Number(hora) || 0))),
      zona: zonaActual(),
      lat: Number.isFinite(lat) ? lat : null,
      lon: Number.isFinite(lon) ? lon : null,
      ultimo_envio: null,
    }, { onConflict: 'endpoint' })

    return error
      ? { ok: false, motivo: 'No se pudo guardar el aviso. Inténtalo más tarde.' }
      : { ok: true }
  } catch {
    return { ok: false, motivo: 'No se pudo activar el aviso en este navegador.' }
  }
}

/** Quita el aviso de este navegador y borra la suscripción guardada. */
export async function desactivar(supabase) {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    return { ok: false, motivo: 'Este navegador no admite avisos push.' }
  }
  try {
    const registro = await navigator.serviceWorker.ready
    const suscripcion = await registro.pushManager.getSubscription()
    if (!suscripcion) return { ok: true }

    let error = null
    if (supabase) {
      ;({ error } = await supabase.from('avisos_push').delete().eq('endpoint', suscripcion.endpoint))
    }
    await suscripcion.unsubscribe()
    return error
      ? { ok: false, motivo: 'Se quitó del navegador, pero no se pudo borrar del servidor.' }
      : { ok: true }
  } catch {
    return { ok: false, motivo: 'No se pudo desactivar el aviso en este navegador.' }
  }
}
