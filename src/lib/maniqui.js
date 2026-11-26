// Maniquí: medidas del cuerpo, huecos donde imantar cada prenda y reglas
// para vestirlo. Las coordenadas son porcentajes de un escenario cuadrado.

// Medidas del maniquí, sacadas de su dibujo (LienzoOutfit).
export const CUERPO = {
  cuello: 17.4, // base del cuello: de aquí cuelgan camisetas y abrigos
  hombros: { y: 19.6, ancho: 21 },
  pecho: { y: 26, ancho: 18 },
  cintura: { y: 34, ancho: 14.5 },
  cadera: { y: 41.5, ancho: 19.4 },
  entrepierna: 48.5,
  rodilla: 66,
  tobillo: 88.5,
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

// Cómo se viste cada prenda. En vez de estirarla para llenar un hueco, se
// mide una parte de la foto cuyo tamaño real se conoce (el cuerpo de una
// camiseta, la cinturilla de un pantalón) y se escala para que coincida con
// esa misma parte del maniquí. El resto (largo, mangas, vuelo) sale solo,
// con las proporciones reales de la prenda.
//  - filas: tramo de la altura de la prenda donde se mide su anchura
//  - percentil: qué anchura de ese tramo cuenta (bajo = la más estrecha,
//    para no medir las mangas; 0.5 = la mediana)
//  - ancho: anchura que debe tener esa parte sobre el maniquí (con holgura)
//  - arriba: altura a la que queda el borde superior de la prenda
//  - alto: largo mínimo y máximo razonables, por si la medida falla
//  - envoltura: una prenda puesta rodea el cuerpo, así que de frente se ve
//    más estrecha que en la foto plana (≈ 0,8), pero conserva su largo
//  - zona + ancla: calzado y gorros caben en una zona sin deformarse
export const VESTIR = {
  torso: { filas: [0.45, 0.85], percentil: 0.2, ancho: 19.6, envoltura: 0.82, arriba: CUERPO.cuello, alto: [12, 40], anchoMax: 42 },
  abrigo: { filas: [0.4, 0.8], percentil: 0.2, ancho: 22.4, envoltura: 0.85, arriba: CUERPO.cuello - 0.6, alto: [16, 74], anchoMax: 48 },
  vestido: { filas: [0.2, 0.5], percentil: 0.1, ancho: 15.6, envoltura: 0.85, arriba: CUERPO.cuello + 0.4, alto: [18, 76], anchoMax: 46 },
  piernas: { filas: [0, 0.06], percentil: 0.5, ancho: 16.4, envoltura: 0.8, arriba: 36, alto: [9, 59], anchoMax: 36 },
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
