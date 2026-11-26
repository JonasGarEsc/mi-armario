// Supabase Edge Function: mira la foto de una prenda y devuelve sus etiquetas.
//
// Entrada (JSON, con la sesión del usuario en la cabecera Authorization):
//   { ruta: "<uuid>/prenda-….webp" }                     foto ya subida al bucket «prendas»
//   { imagen_base64: "…", tipo_mime: "image/webp" }      foto aún sin subir (ya comprimida)
// Salida: { nombre, tipo, categoria, largo, temporada, abrigo, formalidad, estampado }
//
// La clave de Anthropic vive solo aquí, como secreto de Supabase (ANTHROPIC_API_KEY).
// Despliegue y secretos: ver el README, apartado «Etiquetado automático».

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MODELO = Deno.env.get('MODELO_ETIQUETADO') ?? 'claude-sonnet-5-5'
const MAX_BYTES = 1_500_000 // las fotos van comprimidas a ~250 KB; esto es un tope de seguridad
const TIPOS_PERMITIDOS = ['image/webp', 'image/png', 'image/jpeg']

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

const INSTRUCCIONES = `Eres el estilista de un armario personal. Miras la foto de UNA prenda y la describes para
una app. Responde SOLO con un objeto JSON, sin texto antes ni después, con estas claves:

- "nombre": nombre corto y descriptivo en español, con el color (ej. "Camiseta negra de manga corta").
- "tipo": uno de los tipos que ya tiene la persona (lista abajo); si ninguno encaja, propón uno nuevo corto.
- "categoria": una de las categorías de ese tipo (lista abajo); si ninguna encaja, propón una nueva corta.
- "largo": uno de crop, cadera, corto, bermuda, tobillero, rodilla, mini, midi, maxi, largo, o null.
    Camisetas/tops: crop (acaba sobre el ombligo) o cadera. Pantalones: corto, bermuda, tobillero o largo.
    Faldas y vestidos: mini, rodilla, midi o maxi. Abrigos: cadera, rodilla o largo. Calzado y accesorios: null.
- "temporada": lista con uno o varios de invierno, entretiempo, verano.
- "abrigo": entero de 1 a 5 (1 tirantes o muy fresca, 3 media, 5 plumífero o muy abrigada).
- "formalidad": entero de 1 a 5 (1 deporte o ropa de casa, 2 casual, 3 arreglado, 4 elegante, 5 gala).
- "estampado": uno de liso, rayas, cuadros, flores, logo, otro.

Si dudas de un campo, pon null en vez de inventar.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405)

  const claveIA = Deno.env.get('ANTHROPIC_API_KEY')
  if (!claveIA) return responder({ error: 'Falta el secreto ANTHROPIC_API_KEY' }, 500)

  // Con la sesión del usuario: Storage y las tablas aplican su RLS, así que solo ve lo suyo.
  const autorizacion = req.headers.get('Authorization') ?? ''
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: autorizacion } },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return responder({ error: 'Sesión no válida' }, 401)

  let cuerpo: { ruta?: string; imagen_base64?: string; tipo_mime?: string }
  try {
    cuerpo = await req.json()
  } catch {
    return responder({ error: 'JSON no válido' }, 400)
  }

  // --- La foto ---------------------------------------------------------------
  let bytes: Uint8Array
  let tipoMime = cuerpo.tipo_mime ?? 'image/webp'

  if (cuerpo.ruta) {
    // Solo fotos propias: la carpeta del bucket es el id del usuario.
    if (!cuerpo.ruta.startsWith(`${user.id}/`) || cuerpo.ruta.includes('..')) {
      return responder({ error: 'Esa foto no es tuya' }, 403)
    }
    const { data, error } = await supabase.storage.from('prendas').download(cuerpo.ruta)
    if (error || !data) return responder({ error: 'No se pudo leer la foto' }, 404)
    bytes = new Uint8Array(await data.arrayBuffer())
    tipoMime = data.type || (cuerpo.ruta.endsWith('.png') ? 'image/png' : 'image/webp')
  } else if (cuerpo.imagen_base64) {
    try {
      bytes = Uint8Array.from(atob(cuerpo.imagen_base64), (c) => c.charCodeAt(0))
    } catch {
      return responder({ error: 'Imagen no válida' }, 400)
    }
  } else {
    return responder({ error: 'Falta la foto' }, 400)
  }

  if (bytes.length === 0 || bytes.length > MAX_BYTES) return responder({ error: 'La foto es demasiado grande' }, 413)
  if (!TIPOS_PERMITIDOS.includes(tipoMime)) return responder({ error: 'Formato no admitido' }, 415)

  // --- Cuota diaria (cerrado por defecto) ----------------------------------
  const { data: cuota, error: errorCuota } = await supabase.rpc('consumir_cuota', { nombre: 'etiquetar-prenda' })
  if (errorCuota || cuota !== true) {
    return responder({ error: 'Has alcanzado el límite de hoy. Inténtalo mañana.' }, 429)
  }

  // --- Lo que ya tiene la persona, para clasificar con sus nombres ----------
  const { data: categorias } = await supabase.from('categorias').select('nombre, tipos(nombre)')
  const porTipo = new Map<string, string[]>()
  for (const c of categorias ?? []) {
    // deno-lint-ignore no-explicit-any
    const tipo = (c as any).tipos?.nombre
    if (!tipo) continue
    porTipo.set(tipo, [...(porTipo.get(tipo) ?? []), c.nombre])
  }
  const lista = [...porTipo.entries()].map(([t, cs]) => `- ${t}: ${cs.join(', ')}`).join('\n') || '(todavía no tiene ninguno)'

  // --- Claude ----------------------------------------------------------------
  let respuesta: Response
  try {
    respuesta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': claveIA, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 500,
        system: INSTRUCCIONES,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: tipoMime, data: aBase64(bytes) } },
            { type: 'text', text: `Tipos y categorías que ya tiene la persona:\n${lista}\n\nDescribe la prenda de la foto.` },
          ],
        }],
      }),
    })
  } catch (error) {
    console.error('Anthropic', error instanceof Error ? error.name : 'error')
    return responder({ error: 'El servicio de visión no respondió' }, 502)
  }

  if (!respuesta.ok) {
    console.error('Anthropic', respuesta.status, await respuesta.text())
    return responder({ error: 'El servicio de visión no respondió' }, 502)
  }

  const resultado = await respuesta.json()
  const texto: string = resultado.content?.find((b: { type: string }) => b.type === 'text')?.text ?? ''
  const inicio = texto.indexOf('{')
  const fin = texto.lastIndexOf('}')
  if (inicio === -1 || fin <= inicio) return responder({ error: 'Respuesta sin formato' }, 502)

  try {
    return responder(JSON.parse(texto.slice(inicio, fin + 1)))
  } catch {
    return responder({ error: 'Respuesta no válida' }, 502)
  }
})
