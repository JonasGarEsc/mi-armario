// Lógica pura de «leer-enlace»: validación de URL/IP y extracción del HTML.
// Sin Deno ni red, para poder probarla desde node:test.

export const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp']

const MAX_URL = 2048

// --- Direcciones IP ---------------------------------------------------------

function bytesIPv4(texto) {
  const partes = String(texto).split('.')
  if (partes.length !== 4) return null
  const bytes = partes.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN))
  return bytes.every((b) => Number.isInteger(b) && b >= 0 && b <= 255) ? bytes : null
}

function gruposIPv6(texto) {
  let s = String(texto).toLowerCase().split('%')[0]
  let embebida = null

  if (s.includes('.')) {
    const corte = s.lastIndexOf(':')
    const v4 = bytesIPv4(s.slice(corte + 1))
    if (!v4) return null
    embebida = v4
    s = `${s.slice(0, corte + 1)}0:0`
  }

  const bloques = s.split('::')
  if (bloques.length > 2) return null
  const izquierda = bloques[0] ? bloques[0].split(':') : []
  const derecha = bloques.length === 2 && bloques[1] ? bloques[1].split(':') : []
  const hueco = 8 - izquierda.length - derecha.length
  if (bloques.length === 1 ? izquierda.length !== 8 : hueco < 0) return null

  const todos = [...izquierda, ...Array(bloques.length === 2 ? hueco : 0).fill('0'), ...derecha]
  if (todos.length !== 8 || !todos.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null
  return { grupos: todos.map((g) => parseInt(g, 16)), embebida }
}

export const esIPv4 = (texto) => bytesIPv4(texto) !== null
export const esIPv6 = (texto) => gruposIPv6(texto) !== null
export const esIpLiteral = (texto) => esIPv4(texto) || esIPv6(texto)

function ipv4Prohibida([a, b, c]) {
  return a === 0 // 0.0.0.0/8
    || a === 10 // privada
    || a === 127 // loopback
    || (a === 100 && b >= 64 && b <= 127) // CGNAT 100.64/10
    || (a === 169 && b === 254) // link-local
    || (a === 172 && b >= 16 && b <= 31) // privada
    || (a === 192 && b === 168) // privada
    || (a === 192 && b === 0 && c === 0) // 192.0.0.0/24
    || (a === 198 && (b === 18 || b === 19)) // pruebas 198.18/15
    || (a === 198 && b === 51 && c === 100) // documentación
    || (a === 203 && b === 0 && c === 113) // documentación
    || a >= 224 // multicast y reservadas (incluye 255.255.255.255)
}

/** ¿Es una IP que no debe visitarse nunca (privada, local, reservada)? */
export function esDireccionProhibida(ip) {
  const v4 = bytesIPv4(ip)
  if (v4) return ipv4Prohibida(v4)

  const v6 = gruposIPv6(ip)
  if (!v6) return true // lo que no se entiende, se rechaza

  const g = v6.grupos
  // 6to4 y NAT64 llevan una IPv4 dentro, que puede ser privada.
  if (g[0] === 0x2002 || (g[0] === 0x64 && g[1] === 0xff9b)) return true
  if (g.every((x) => x === 0)) return true // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true // ::1
  if ((g[0] & 0xffc0) === 0xfe80) return true // link-local fe80::/10
  if ((g[0] & 0xfe00) === 0xfc00) return true // única local fc00::/7
  if ((g[0] & 0xff00) === 0xff00) return true // multicast ff00::/8
  // IPv4 mapeada o compatible en IPv6 (::ffff:a.b.c.d): se valida la IPv4 de dentro.
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && (g[5] === 0xffff || g[5] === 0)) {
    const v4 = v6.embebida ?? [(g[6] >> 8) & 255, g[6] & 255, (g[7] >> 8) & 255, g[7] & 255]
    if (ipv4Prohibida(v4)) return true
  }
  return false
}

/** Nombres que nunca se resuelven (o solo apuntan a la propia red). */
export function nombreProhibido(host) {
  const h = String(host).toLowerCase().replace(/\.$/, '')
  return h === 'localhost'
    || h.endsWith('.localhost')
    || h.endsWith('.local')
    || h.endsWith('.internal')
    || h === 'internal'
}

/**
 * Comprueba la forma de la URL. No resuelve DNS (eso necesita red y lo hace la
 * función). Devuelve `{ url, host }` o null si no es apta.
 */
export function validarUrl(texto) {
  if (typeof texto !== 'string' || !texto.trim() || texto.length > MAX_URL) return null
  let url
  try {
    url = new URL(texto.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  if (url.port !== '') return null // solo el puerto por defecto (443)
  if (url.username || url.password) return null
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase()
  if (!host || nombreProhibido(host)) return null
  if (esIpLiteral(host) && esDireccionProhibida(host)) return null
  return { url, host }
}

// --- Extracción del HTML ----------------------------------------------------

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', euro: '€', hellip: '…' }

export function decodificarHtml(texto) {
  return String(texto ?? '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (original, clave) => {
    if (clave[0] === '#') {
      const codigo = clave[1].toLowerCase() === 'x' ? parseInt(clave.slice(2), 16) : parseInt(clave.slice(1), 10)
      return Number.isFinite(codigo) && codigo > 0 && codigo <= 0x10ffff ? String.fromCodePoint(codigo) : original
    }
    return ENTIDADES[clave.toLowerCase()] ?? original
  })
}

function leerAtributos(tag) {
  const attrs = {}
  const re = /([a-z0-9:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/gi
  let coincidencia
  while ((coincidencia = re.exec(tag))) {
    attrs[coincidencia[1].toLowerCase()] = coincidencia[3] ?? coincidencia[4] ?? coincidencia[5] ?? ''
  }
  return attrs
}

const limpiarTexto = (valor, max) => {
  const t = decodificarHtml(valor).replace(/\s+/g, ' ').trim()
  return t ? t.slice(0, max) : null
}

/** Convierte un precio de la página («29,95 €», «1.299.00») a número. */
export function aPrecio(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  let numero
  if (typeof valor === 'number') {
    numero = valor
  } else {
    const texto = String(valor).replace(/[^\d.,]/g, '')
    if (!texto) return null
    const coma = texto.lastIndexOf(',')
    const punto = texto.lastIndexOf('.')
    let limpio = texto
    if (coma !== -1 && punto !== -1) {
      limpio = coma > punto ? texto.replace(/\./g, '').replace(',', '.') : texto.replace(/,/g, '')
    } else if (coma !== -1) {
      limpio = texto.replace(',', '.')
    }
    if ((limpio.match(/\./g) || []).length > 1) limpio = limpio.replace(/\./g, '')
    numero = Number(limpio)
  }
  if (!Number.isFinite(numero) || numero < 0 || numero > 1e8) return null
  return Math.round(numero * 100) / 100
}

/** Une una URL relativa (og:image suele venir así) con la de la página. */
export function urlAbsoluta(valor, base) {
  const v = decodificarHtml(valor).trim()
  if (!v) return null
  try {
    return new URL(v, base || undefined).href
  } catch {
    return null
  }
}

function preciosDeJsonLd(datos, salida) {
  if (!datos || typeof datos !== 'object') return
  if (Array.isArray(datos)) {
    datos.forEach((d) => preciosDeJsonLd(d, salida))
    return
  }
  const ofertas = datos.offers ?? datos.offer
  for (const oferta of Array.isArray(ofertas) ? ofertas : [ofertas]) {
    if (!oferta || typeof oferta !== 'object') continue
    const precio = oferta.price ?? oferta.lowPrice ?? oferta.priceSpecification?.price
    if (precio !== undefined && precio !== null) salida.push(precio)
  }
  if (datos['@graph']) preciosDeJsonLd(datos['@graph'], salida)
}

/**
 * Saca nombre, precio e imagen de una página de tienda. Prioridad:
 * og:title / og:image, y el precio de product:price:amount, og:price:amount
 * o, si no están, del JSON-LD de ofertas.
 */
export function extraerDatos(html, baseUrl = '') {
  const texto = String(html ?? '')
  let titulo = null
  let imagen = null
  let precio = null

  for (const tag of texto.match(/<meta\b[^>]*>/gi) ?? []) {
    const a = leerAtributos(tag)
    const clave = (a.property || a.name || '').toLowerCase()
    const valor = a.content
    if (!valor) continue
    if (!titulo && clave === 'og:title') titulo = valor
    if (!imagen && (clave === 'og:image' || clave === 'og:image:url')) imagen = valor
    if (precio == null && (clave === 'product:price:amount' || clave === 'og:price:amount')) precio = valor
  }

  if (!titulo) {
    const enTitle = texto.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    if (enTitle) titulo = enTitle[1]
  }

  if (precio == null) {
    const precios = []
    const re = /<script\b[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi
    let bloque
    while ((bloque = re.exec(texto))) {
      try {
        preciosDeJsonLd(JSON.parse(bloque[1]), precios)
      } catch {
        // un JSON-LD roto no impide usar el resto de la página
      }
    }
    precio = precios.find((p) => aPrecio(p) !== null) ?? null
  }

  return {
    nombre: limpiarTexto(titulo, 80),
    precio: aPrecio(precio),
    imagen: urlAbsoluta(imagen, baseUrl),
  }
}
