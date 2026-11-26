// Colores de una prenda a partir de los píxeles de su foto (ya recortada).
// Todo ocurre en el dispositivo: sin red y sin coste. Se trabaja en OKLab, donde
// la distancia entre colores se parece a la que percibe el ojo.

const aLineal = (c) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const deLineal = (v) => {
  const x = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055
  return Math.round(Math.min(1, Math.max(0, x)) * 255)
}

/** [r, g, b] (0-255) → [L, a, b] de OKLab. */
export function rgbAOklab(r, g, b) {
  const lr = aLineal(r), lg = aLineal(g), lb = aLineal(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** [L, a, b] de OKLab → "#rrggbb". */
export function oklabAHex(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const canales = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(deLineal)
  return '#' + canales.map((c) => c.toString(16).padStart(2, '0')).join('')
}

export function hexARgb(hex) {
  const limpio = String(hex || '').replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(limpio)) return null
  return [0, 2, 4].map((i) => parseInt(limpio.slice(i, i + 2), 16))
}

/** Luminosidad (0-1), croma y tono (0-360) de un color hex, en OKLCH. */
export function oklchDeHex(hex) {
  const rgb = hexARgb(hex)
  if (!rgb) return null
  const [L, a, b] = rgbAOklab(...rgb)
  const h = (Math.atan2(b, a) * 180) / Math.PI
  return { L, C: Math.hypot(a, b), h: h < 0 ? h + 360 : h }
}

const distancia2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2

/**
 * K-means pequeño y determinista sobre puntos ponderados [L, a, b, peso].
 * Los centros iniciales se eligen por el más lejano a los ya elegidos.
 */
export function agrupar(puntos, k, vueltas = 8) {
  if (puntos.length === 0) return []
  const centros = [puntos.reduce((mejor, p) => (p[3] > mejor[3] ? p : mejor)).slice(0, 3)]
  while (centros.length < Math.min(k, puntos.length)) {
    let lejano = null
    let mayor = 0
    for (const p of puntos) {
      const d = Math.min(...centros.map((c) => distancia2(p, c))) * p[3]
      if (d > mayor) { mayor = d; lejano = p }
    }
    if (!lejano || mayor === 0) break
    centros.push(lejano.slice(0, 3))
  }

  let pesos = []
  for (let v = 0; v < vueltas; v++) {
    const suma = centros.map(() => [0, 0, 0, 0])
    for (const p of puntos) {
      let mejor = 0
      let dMejor = Infinity
      centros.forEach((c, i) => {
        const d = distancia2(p, c)
        if (d < dMejor) { dMejor = d; mejor = i }
      })
      const s = suma[mejor]
      s[0] += p[0] * p[3]; s[1] += p[1] * p[3]; s[2] += p[2] * p[3]; s[3] += p[3]
    }
    pesos = suma.map((s) => s[3])
    suma.forEach((s, i) => { if (s[3] > 0) centros[i] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]] })
  }
  return centros.map((c, i) => ({ centro: c, peso: pesos[i] || 0 }))
}

const esBlancoOGris = ([L, a, b]) => Math.hypot(a, b) < 0.03 && L > 0.93
const esNegro = ([L]) => L < 0.2

/**
 * Hasta `max` colores dominantes (hex, el mayor primero) de datos RGBA.
 * Solo cuentan los píxeles opacos. Los casi blancos o casi negros se ignoran
 * si son minoría (reflejos, sombras, logos); si dominan, se quedan: una camiseta
 * blanca es blanca.
 */
export function coloresDominantes(datos, { max = 3, minimoFraccion = 0.08 } = {}) {
  // Histograma en OKLab: agrupa píxeles casi iguales y deja el k-means diminuto.
  const PASO = 0.035
  const cubos = new Map()
  let total = 0
  for (let i = 0; i < datos.length; i += 4) {
    if (datos[i + 3] < 200) continue
    const lab = rgbAOklab(datos[i], datos[i + 1], datos[i + 2])
    const clave = lab.map((v) => Math.round(v / PASO)).join(',')
    const c = cubos.get(clave)
    if (c) { c[0] += lab[0]; c[1] += lab[1]; c[2] += lab[2]; c[3]++ }
    else cubos.set(clave, [lab[0], lab[1], lab[2], 1])
    total++
  }
  if (total === 0) return []

  let puntos = [...cubos.values()].map(([L, a, b, n]) => [L / n, a / n, b / n, n])
  const claros = puntos.filter((p) => esBlancoOGris(p) || esNegro(p))
  const pesoExtremos = claros.reduce((s, p) => s + p[3], 0)
  // Con color de por medio, los extremos minoritarios se descartan.
  if (pesoExtremos / total < 0.45 && claros.length < puntos.length) {
    puntos = puntos.filter((p) => !(esBlancoOGris(p) || esNegro(p)))
  }

  const grupos = agrupar(puntos, max + 1)
    .filter((g) => g.peso > 0)
    .sort((x, y) => y.peso - x.peso)

  // Une grupos casi iguales (el mismo tono en dos matices).
  const resultado = []
  for (const g of grupos) {
    const igual = resultado.find((r) => Math.sqrt(distancia2(r.centro, g.centro)) < 0.07)
    if (igual) igual.peso += g.peso
    else resultado.push({ ...g })
  }
  const base = resultado.reduce((s, g) => s + g.peso, 0)
  return resultado
    .sort((x, y) => y.peso - x.peso)
    .filter((g, i) => i === 0 || g.peso / base >= minimoFraccion)
    .slice(0, max)
    .map((g) => oklabAHex(...g.centro))
}

/** Familia de un color: neutro, pastel, vivo, tierra, cálido o frío. */
export function familiaDeColor(hex) {
  const lch = oklchDeHex(hex)
  if (!lch) return null
  const { L, C, h } = lch
  if (C < 0.04 || L < 0.2 || L > 0.96) return 'neutro'
  if (C > 0.17) return 'vivo'
  if (L > 0.8 && C < 0.1) return 'pastel'
  if (h >= 35 && h < 100 && L < 0.7 && C < 0.14) return 'tierra'
  if (h < 100 || h >= 330) return 'cálido'
  return 'frío'
}

export const FAMILIAS_COLOR = ['neutro', 'cálido', 'frío', 'tierra', 'pastel', 'vivo']

// --- Navegador ------------------------------------------------------------

function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    img.src = src
  })
}

/** Colores y familia de una foto (File, Blob o URL). Devuelve null si falla. */
export async function colorDeImagen(origen, { max = 3 } = {}) {
  const esURL = typeof origen === 'string'
  const src = esURL ? origen : URL.createObjectURL(origen)
  try {
    const img = await cargarImagen(src)
    const lado = 96
    const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * escala))
    const h = Math.max(1, Math.round(img.naturalHeight * escala))
    const lienzo = document.createElement('canvas')
    lienzo.width = w
    lienzo.height = h
    const ctx = lienzo.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, w, h)
    const colores = coloresDominantes(ctx.getImageData(0, 0, w, h).data, { max })
    if (colores.length === 0) return null
    return { colores, familia_color: familiaDeColor(colores[0]) }
  } catch {
    // Canvas contaminado por CORS o sin soporte: la prenda se guarda sin color.
    return null
  } finally {
    if (!esURL) URL.revokeObjectURL(src)
  }
}
