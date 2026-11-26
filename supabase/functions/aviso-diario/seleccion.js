// Lógica pura del aviso diario: hora local, filtros de seguridad, elección de
// la propuesta y texto. Sin red ni Deno, para poder probarla con node:test.

const HOSTS_PUSH = [
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'push.apple.com',
  'notify.windows.com',
]

/** Solo https y servicios push conocidos: evita que una fila lleve a otra URL (SSRF). */
export function endpointPushValido(endpoint) {
  try {
    const url = new URL(String(endpoint))
    if (url.protocol !== 'https:' || url.username || url.password) return false
    const host = url.hostname.toLowerCase()
    return HOSTS_PUSH.some((permitido) => host === permitido || host.endsWith(`.${permitido}`))
  } catch {
    return false
  }
}

function partesLocales(fecha, zona) {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      timeZone: zona,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(fecha)
  } catch {
    return null
  }
}

/** Hora local (0-23) de una fecha en una zona IANA; null si la zona no vale. */
export function horaLocal(fecha, zona) {
  const partes = partesLocales(fecha, zona)
  if (!partes) return null
  const hora = Number(partes.find((p) => p.type === 'hour')?.value)
  return Number.isInteger(hora) ? hora : null
}

/** Fecha local YYYY-MM-DD, que es lo que se guarda en ultimo_envio. */
export function fechaLocal(fecha, zona) {
  const partes = partesLocales(fecha, zona)
  if (!partes) return null
  const valor = (tipo) => partes.find((p) => p.type === tipo)?.value
  const [y, m, d] = [valor('year'), valor('month'), valor('day')]
  return y && m && d ? `${y}-${m}-${d}` : null
}

/** Temporada que pide una temperatura sentida (grados). */
export function temporadaDeTemperatura(temperatura) {
  if (!Number.isFinite(temperatura)) return null
  if (temperatura >= 24) return 'verano'
  if (temperatura <= 12) return 'invierno'
  return 'entretiempo'
}

/** Abrigo (1-5) que apetece con esa temperatura. */
export function abrigoIdeal(temperatura) {
  if (temperatura >= 28) return 1
  if (temperatura >= 23) return 1.5
  if (temperatura >= 18) return 2
  if (temperatura >= 13) return 3
  if (temperatura >= 8) return 4
  return 5
}

const VESTIDO = /vestido|enterizo|overol|jumpsuit|peto|\bmono\b/
const INFERIOR = /pantal|vaquero|jean|falda|short|bermuda|legging|malla|calza/
const SUPERIOR = /camiseta|camisa|blusa|\btop\b|jersey|polo|sujetador|pijama|ba[ñn]ador|bikini|traje|t[uú]nica|\bbody\b|ropa interior|interior/
const NO_ES_ROPA_DEL_DIA = /abrigo|chaqueta|cazadora|gabardina|parka|plum[ií]fero|anorak|blazer|americana|trenca|capote|chaleco|sudadera|c[aá]rdigan|rebeca|zapat|bota|bot[ií]n|sandal|chancla|calzado|sneaker|tenis|mocas|zueco|alpargata|calcet|gorro|gorra|sombrero|visera|bolso|mochila|cintur|joya|collar|pulsera|reloj|gafas|pendiente|anillo|bufanda/
const ABIERTO = /sandalia|chancla|alpargata|zueco|ojotas|cangrejera/i

const textoDe = (p) => [p?.nombre, p?.categorias?.nombre, p?.categorias?.tipos?.nombre]
  .filter(Boolean).join(' ').toLowerCase()

/** Ranura de la propuesta: 'arriba', 'abajo', 'vestido' o null. */
export function ranuraDe(prenda) {
  const texto = textoDe(prenda)
  if (!texto || NO_ES_ROPA_DEL_DIA.test(texto)) return null
  if (VESTIDO.test(texto)) return 'vestido'
  if (INFERIOR.test(texto)) return 'abajo'
  if (SUPERIOR.test(texto)) return 'arriba'
  return null
}

/** ¿La prenda pega con el tiempo de hoy? Sin clima, vale cualquiera. */
export function aptaParaClima(prenda, clima) {
  if (!clima || !Number.isFinite(clima.temp)) return true
  const temporada = temporadaDeTemperatura(clima.temp)
  if (temporada && Array.isArray(prenda.temporada) && prenda.temporada.length) {
    const encaja = prenda.temporada.includes(temporada) || prenda.temporada.includes('entretiempo')
    if (!encaja) return false
  }
  if (Number.isFinite(prenda.abrigo) && Math.abs(prenda.abrigo - abrigoIdeal(clima.temp)) > 2) return false
  if (clima.lluvia && ABIERTO.test(prenda.nombre || '')) return false
  return true
}

function semillaNumero(texto) {
  let hash = 2166136261
  for (const c of String(texto)) {
    hash ^= c.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const elegir = (lista, semilla) => lista[semillaNumero(semilla) % lista.length]

const porId = (a, b) => String(a.id).localeCompare(String(b.id))

/**
 * Una prenda de arriba y otra de abajo; si no hay pareja, un vestido.
 * `semilla` hace que la elección sea estable (por ejemplo, la fecha de hoy).
 */
export function elegirPropuesta(prendas, clima = null, semilla = '') {
  const grupos = { arriba: [], abajo: [], vestido: [] }
  for (const prenda of Array.isArray(prendas) ? prendas : []) {
    if (!prenda || prenda.archivada || prenda.deseada || !aptaParaClima(prenda, clima)) continue
    const ranura = ranuraDe(prenda)
    if (ranura) grupos[ranura].push(prenda)
  }
  for (const lista of Object.values(grupos)) lista.sort(porId)

  if (grupos.arriba.length && grupos.abajo.length) {
    return {
      arriba: elegir(grupos.arriba, `${semilla}|arriba`),
      abajo: elegir(grupos.abajo, `${semilla}|abajo`),
      vestido: null,
    }
  }
  if (grupos.vestido.length) {
    return { arriba: null, abajo: null, vestido: elegir(grupos.vestido, `${semilla}|vestido`) }
  }
  return null
}

/** Título y cuerpo del aviso; null si no hay nada que proponer. */
export function textoPropuesta(propuesta, clima = null) {
  if (!propuesta) return null
  const nombres = propuesta.vestido
    ? [propuesta.vestido.nombre]
    : [propuesta.arriba?.nombre, propuesta.abajo?.nombre].filter(Boolean)
  if (nombres.length === 0) return null

  const tiempo = Number.isFinite(clima?.temp)
    ? `${Math.round(clima.temp)} °C${clima.lluvia ? ' y lluvia' : ''}`
    : ''
  return {
    titulo: 'Tu propuesta de hoy',
    cuerpo: `Hoy te propongo ${nombres.join(' y ')}.${tiempo ? ` ${tiempo}.` : ''}`,
  }
}
