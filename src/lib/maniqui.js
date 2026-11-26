// Maniquí: ranuras donde imantar cada prenda.
// Las coordenadas son porcentajes de un escenario cuadrado.

export const RANURAS = {
  cabeza: { x: 40, y: 2, w: 20, h: 15, capa: 6, etiqueta: 'Cabeza' },
  torso: { x: 29, y: 19, w: 42, h: 31, capa: 3, etiqueta: 'Torso' },
  abrigo: { x: 24, y: 19, w: 52, h: 35, capa: 4, etiqueta: 'Abrigo' },
  vestido: { x: 27, y: 20, w: 46, h: 56, capa: 2, etiqueta: 'Vestido' },
  piernas: { x: 33, y: 45, w: 34, h: 45, capa: 1, etiqueta: 'Piernas' },
  pies: { x: 34, y: 85, w: 32, h: 13, capa: 5, etiqueta: 'Pies' },
  accesorio: { x: 76, y: 40, w: 18, h: 18, capa: 7, etiqueta: 'Accesorio' },
}

// El orden importa: lo más específico va antes que lo genérico.
const PISTAS = [
  ['pies', /zapat|bota|botín|botin|sandal|chancla|calzado|sneaker|tenis|mocas|zueco|calcet|calcetín|calcetin|alpargata/],
  ['cabeza', /gorro|gorra|sombrero|visera|diadema|orejera|bufanda|cuello|sombrilla|paraguas/],
  ['accesorio', /bolso|mochila|cintur|joya|collar|pulsera|reloj|gafas|pendiente|anillo|monedero|billetero|llavero|correa/],
  ['piernas', /pantal|vaquero|jean|falda|short|bermuda|legging|malla|chándal|chandal|calza|pantalón|pantalon/],
  ['vestido', /vestido|enterizo|overol|jumpsuit|peto|\bmono\b/],
  ['abrigo', /abrigo|chaqueta|cazadora|gabardina|parka|plumífero|plumifero|anorak|blazer|americana|trenca|capote|chaleco|sudadera/],
  ['torso', /camiseta|camisa|blusa|top\b|jersey|polo|sujetador|pijama|bañador|banador|bikini|traje|túnica|tunica|body|ropa interior|interior/],
]

const ANTES = [
  ['torso', /bañador|banador|bikini|traje de baño|vestido de baño/],
]

/** Deduce la ranura a partir del nombre de la categoría, del tipo o de la prenda. */
export function inferirRanura(...textos) {
  const texto = textos.filter(Boolean).join(' ').toLowerCase()
  if (!texto.trim()) return null

  for (const [ranura, patron] of ANTES) if (patron.test(texto)) return ranura
  for (const [ranura, patron] of PISTAS) if (patron.test(texto)) return ranura
  return null
}

/** La ranura cuyo centro está más cerca del punto donde sueltas. */
export function ranuraMasCercana(x, y) {
  let mejor = null
  let distancia = Infinity
  for (const [clave, r] of Object.entries(RANURAS)) {
    const cx = r.x + r.w / 2
    const cy = r.y + r.h / 2
    const d = (cx - x) ** 2 + (cy - y) ** 2
    if (d < distancia) {
      distancia = d
      mejor = clave
    }
  }
  return mejor
}

/** ¿El punto (en %) cae sobre el cuerpo? Fuera de ahí la prenda queda libre. */
export function dentroDelManiqui(x, y) {
  return x >= 12 && x <= 88 && y >= 0 && y <= 100
}
