// Supabase Edge Function: lee la página de una tienda y devuelve nombre, precio
// y la foto del producto. Así se puede apuntar un deseo sin copiar nada a mano.
//
// Entrada (JSON, con la sesión del usuario en la cabecera Authorization):
//   { url: "https://tienda.example/producto" }
// Salida: { nombre, precio, imagen_base64, tipo_mime }
//
// La imagen vuelve en base64 para que el navegador no tenga que pedirla al
// servidor de la tienda (CORS). Los filtros de URL/IP evitan SSRF.
// Despliegue: supabase functions deploy leer-enlace

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { TIPOS_IMAGEN, esDireccionProhibida, esIpLiteral, extraerDatos, validarUrl } from './enlace.js'

const MAX_HTML = 2_000_000
const MAX_IMAGEN = 5_000_000
const MAX_REDIRECCIONES = 3
const ESPERA_MS = 8000
const AGENTE = 'Mozilla/5.0 (compatible; Perletta/1.0; +https://perletta.app)'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

function aBase64(bytes: Uint8Array): string {
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binario)
}

const conLimite = async <T>(promesa: Promise<T>, restante: () => number): Promise<T> => {
  const ms = restante()
  if (ms <= 0) throw new Error('tiempo')
  let temporizador: number | undefined
  try {
    return await Promise.race([
      promesa,
      new Promise<never>((_, rechazar) => {
        temporizador = setTimeout(() => rechazar(new Error('tiempo')), ms)
      }),
    ])
  } finally {
    if (temporizador !== undefined) clearTimeout(temporizador)
  }
}

/** Resuelve A y AAAA y rechaza si alguna IP no es pública. */
async function hostPermitido(host: string, restante: () => number): Promise<boolean> {
  if (esIpLiteral(host)) return !esDireccionProhibida(host)
  const resultados = await conLimite(
    Promise.allSettled([Deno.resolveDns(host, 'A'), Deno.resolveDns(host, 'AAAA')]),
    restante,
  )
  const ips = resultados.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  return ips.length > 0 && ips.every((ip) => !esDireccionProhibida(ip))
}

async function urlPermitida(texto: string, restante: () => number): Promise<URL | null> {
  const revisada = validarUrl(texto)
  if (!revisada) return null
  return (await hostPermitido(revisada.host, restante)) ? revisada.url : null
}

async function leerCuerpo(respuesta: Response, maximo: number): Promise<Uint8Array | null> {
  if (!respuesta.body) return null
  const lector = respuesta.body.getReader()
  const trozos: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await lector.read()
    if (done) break
    total += value.byteLength
    if (total > maximo) {
      await lector.cancel()
      return null
    }
    trozos.push(value)
  }
  const bytes = new Uint8Array(total)
  let posicion = 0
  for (const trozo of trozos) {
    bytes.set(trozo, posicion)
    posicion += trozo.byteLength
  }
  return bytes
}

const esRedireccion = (status: number) => [301, 302, 303, 307, 308].includes(status)

/**
 * Descarga siguiendo redirecciones a mano (máx. 3) y revalidando cada salto.
 * `soloImagen` exige que el tipo servido sea jpeg, png o webp.
 */
async function descargar(
  inicial: string,
  maximo: number,
  restante: () => number,
  soloImagen: boolean,
): Promise<{ bytes: Uint8Array; tipo: string; url: string }> {
  let destino = await urlPermitida(inicial, restante)
  if (!destino) throw new Error('url')

  for (let salto = 0; salto <= MAX_REDIRECCIONES; salto++) {
    const respuesta = await conLimite(
      fetch(destino.href, {
        redirect: 'manual',
        signal: AbortSignal.timeout(Math.max(1, restante())),
        headers: {
          'user-agent': AGENTE,
          accept: 'text/html,application/xhtml+xml,image/jpeg,image/png,image/webp;q=0.9,*/*;q=0.5',
        },
      }),
      restante,
    )

    if (esRedireccion(respuesta.status)) {
      if (salto === MAX_REDIRECCIONES) throw new Error('redirecciones')
      const ubicacion = respuesta.headers.get('location')
      await respuesta.body?.cancel()
      if (!ubicacion) throw new Error('redireccion')
      destino = await urlPermitida(new URL(ubicacion, destino).href, restante)
      if (!destino) throw new Error('url')
      continue
    }

    if (!respuesta.ok) {
      await respuesta.body?.cancel()
      throw new Error('respuesta')
    }

    const tipo = (respuesta.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    if (soloImagen && !TIPOS_IMAGEN.includes(tipo)) {
      await respuesta.body?.cancel()
      throw new Error('tipo')
    }

    const bytes = await conLimite(leerCuerpo(respuesta, maximo), restante)
    if (!bytes || bytes.length === 0) throw new Error('cuerpo')
    return { bytes, tipo, url: destino.href }
  }

  throw new Error('redirecciones')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405)

  // Con la sesión del usuario, igual que el resto de funciones.
  const autorizacion = req.headers.get('Authorization') ?? ''
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: autorizacion } },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return responder({ error: 'Sesión no válida' }, 401)

  let cuerpo: { url?: unknown }
  try {
    cuerpo = await req.json()
  } catch {
    return responder({ error: 'JSON no válido' }, 400)
  }
  if (typeof cuerpo.url !== 'string' || !cuerpo.url.trim()) return responder({ error: 'Falta el enlace' }, 400)
  const url = cuerpo.url

  const inicio = Date.now()
  const restante = () => ESPERA_MS - (Date.now() - inicio)

  try {
    const pagina = await descargar(url, MAX_HTML, restante, false)
    const datos = extraerDatos(new TextDecoder().decode(pagina.bytes), pagina.url)

    let imagenBase64: string | null = null
    let tipoMime: string | null = null
    if (datos.imagen) {
      try {
        const imagen = await descargar(datos.imagen, MAX_IMAGEN, restante, true)
        imagenBase64 = aBase64(imagen.bytes)
        tipoMime = imagen.tipo
      } catch {
        // Sin foto: el nombre y el precio siguen siendo útiles.
      }
    }

    return responder({
      nombre: datos.nombre,
      precio: datos.precio,
      imagen_base64: imagenBase64,
      tipo_mime: tipoMime,
    })
  } catch (error) {
    console.error('leer-enlace', error instanceof Error ? error.message : 'error')
    return responder({ error: 'No se pudo leer el enlace' }, 502)
  }
})
