// Maniquí: medidas del cuerpo, huecos donde imantar cada prenda y reglas
// para vestirlo. Las coordenadas son porcentajes de un escenario cuadrado.

// Medidas del maniquí, sacadas de su dibujo (LienzoOutfit).
export const CUERPO = {
  cuello: 17.4, // base del cuello: de aquí cuelgan camisetas y abrigos
  hombros: { y: 19.6, ancho: 21 },
  pecho: { y: 26, ancho: 18 },
  cintura: { y: 34, ancho: 14.4 },
  ombligo: 37,
  cadera: { y: 42.5, ancho: 18 },
  entrepierna: 50,
  rodilla: 66,
  tobillo: 88.6,
  suelo: 95,
}

// Huecos donde se imanta cada prenda: sirven para soltarla y para agarrarla.
export const RANURAS = {
  cabeza: { x: 40, y: 0, w: 20, h: 15, capa: 6, etiqueta: 'Cabeza' },
  torso: { x: 36, y: 16, w: 28, h: 26, capa: 3, etiqueta: 'Torso' },
  abrigo: { x: 33, y: 16, w: 34, h: 34, capa: 4, etiqueta: 'Abrigo' },
  vestido: { x: 36, y: 17, w: 28, h: 50, capa: 2, etiqueta: 'Vestido' },
  piernas: { x: 38, y: 35, w: 24, h: 55, capa: 1, etiqueta: 'Piernas' },
  pies: { x: 38, y: 85, w: 24, h: 12, capa: 5, etiqueta: 'Pies' },
  accesorio: { x: 76, y: 40, w: 18, h: 18, capa: 7, etiqueta: 'Accesorio' },
}

// Cómo se viste cada tipo de prenda (ver lib/vestir).
//  - arriba: altura del cuerpo donde empieza (cuello, cintura, cadera)
//  - largos: [patrón, altura del bajo, 'nombre'?]; se busca en el nombre de
//    la prenda, luego en su categoría y luego en su tipo; el primero que
//    encaja manda. Con 'nombre' solo cuenta el nombre (una categoría «Tops»
//    no convierte todas las camisetas en tops cortos).
//  - posibles: si ningún patrón encaja, el bajo se lleva al largo realista
//    más cercano al que sugiere la forma de la foto (o `defecto` sin medidas)
//  - proporcion: convierte la relación largo/anchura medida en la foto en un
//    largo sobre el maniquí (calibrada con prendas reales: un pantalón largo
//    mide ~2,8 veces su cinturilla, un 3/4 ~2, una bermuda ~1,5, un short ~1)
//  - filas/percentil/ancho: dónde se mide la anchura de la prenda en la foto
//    (el cuerpo sin mangas, la cinturilla...) y cuánto debe medir puesta
//  - envoltura: puesta, la prenda rodea el cuerpo y de frente se ve más
//    estrecha que en la foto plana
//  - hombros: la parte alta de la prenda (con el arranque de las mangas)
//    debe cubrir hombros y brazos del maniquí: es un ancho mínimo
//  - anchoMax: tope de anchura total (mangas incluidas)
//  - zona + ancla: calzado y gorros caben en una zona sin deformarse
const CROP = CUERPO.ombligo - 5.5 // un top acaba por encima del ombligo
const CADERA = 46 // camiseta: tapa la cinturilla del pantalón
const RODILLA = CUERPO.rodilla

export const VESTIR = {
  torso: {
    arriba: CUERPO.cuello,
    largos: [
      [/\bcrop|\btops?\b|bralette|sujetador|bikini|biquini|corpiño|corpino/, CROP, 'nombre'],
      [/bañador|banador|maillot|\bbody\b/, 49],
      [/túnica|tunica|oversize/, 49],
      [/camisa|blusa/, 45.5],
      [/jersey|su[eé]ter|sudadera|polo|punto|pijama|camiseta|tirantes|manga/, CADERA],
    ],
    posibles: [CROP, CADERA],
    defecto: CADERA,
    proporcion: 17.7,
    filas: [0.45, 0.85], percentil: 0.2, ancho: 19.6, envoltura: 0.82, anchoMax: 40,
    hombros: { filas: [0.04, 0.3], percentil: 0.9, ancho: 25.5 },
  },
  abrigo: {
    arriba: CUERPO.cuello - 0.6,
    largos: [
      [/chaleco/, 44],
      [/corto|crop/, 47],
      [/largo|gabardina|trenca|capote/, RODILLA + 8],
      [/abrigo|parka/, RODILLA],
      [/plum[ií]fero|anorak|cazadora|bomber|chaqueta|americana|blazer|sudadera|c[aá]rdigan|rebeca/, 47],
    ],
    posibles: [47, RODILLA],
    defecto: 47,
    proporcion: 26.5,
    filas: [0.4, 0.8], percentil: 0.2, ancho: 22.4, envoltura: 0.85, anchoMax: 46,
    hombros: { filas: [0.04, 0.3], percentil: 0.9, ancho: 27 },
  },
  vestido: {
    arriba: CUERPO.cuello + 0.4,
    largos: [
      [/\bmono\b|jumpsuit|enterizo|overol|peto/, CUERPO.tobillo],
      [/mini|corto/, 55],
      [/midi/, 76],
      [/largo|maxi/, CUERPO.tobillo + 1],
    ],
    posibles: [55, 64, 76, CUERPO.tobillo + 1],
    defecto: 64,
    proporcion: 16.8,
    filas: [0.2, 0.5], percentil: 0.1, ancho: 15.6, envoltura: 0.85, anchoMax: 44,
  },
  falda: {
    arriba: CUERPO.cintura.y + 2,
    largos: [
      [/mini/, 51],
      [/midi/, 76],
      [/larga|maxi/, CUERPO.tobillo],
    ],
    posibles: [51, 60, 76, CUERPO.tobillo],
    defecto: 60,
    proporcion: 17,
    filas: [0, 0.06], percentil: 0.5, ancho: 16.4, envoltura: 0.8, anchoMax: 40,
  },
  piernas: {
    arriba: 39.5, // tiro medio: la cinturilla queda por debajo del ombligo
    largos: [
      [/bermuda/, 61],
      [/\bshorts?\b|corto|bañador|banador/, 53],
      [/pirata|capri|3\/4|culotte|tobiller|cropped/, 77],
      [/legging|malla|largo/, CUERPO.tobillo],
    ],
    posibles: [53, 61, 77, CUERPO.tobillo],
    defecto: CUERPO.tobillo,
    proporcion: 17.5,
    filas: [0, 0.06], percentil: 0.5, ancho: 18.6, envoltura: 0.8, anchoMax: 36,
  },
  pies: { zona: { x: 40.5, y: 85.5, w: 19, h: 10 }, ancla: 'abajo' },
  cabeza: { zona: { x: 44, y: 1, w: 12, h: 8.6 }, ancla: 'abajo' },
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
