// PNG mínimo sin dependencias: una camiseta plana sobre fondo transparente.
// Se usa como foto de la prenda que se sube en la prueba de navegador.

import { deflateSync } from 'node:zlib'

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tabla[n] = c >>> 0
  }
  return tabla
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = TABLA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function trozo(tipo, datos) {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(cuerpo))
  return Buffer.concat([largo, cuerpo, crc])
}

/** PNG RGBA de una camiseta de color plano. */
export function crearPngPrenda(color = [66, 94, 138], ancho = 400, alto = 500) {
  const filas = Buffer.alloc((ancho * 4 + 1) * alto)
  let p = 0
  for (let y = 0; y < alto; y++) {
    filas[p++] = 0 // filtro None
    for (let x = 0; x < ancho; x++) {
      const cuerpo = x > 112 && x < 288 && y > 125 && y < 436
      const mangaIzq = x > 58 && x <= 112 && y > 145 && y < 265
      const mangaDer = x >= 288 && x < 342 && y > 145 && y < 265
      const cuello = ((x - 200) / 54) ** 2 + ((y - 126) / 34) ** 2 < 1
      const dentro = (cuerpo || mangaIzq || mangaDer) && !cuello
      const borde = dentro && (
        x < 118 || x > 282 || y < 132 || y > 429 ||
        (x < 112 && (y < 153 || y > 257)) ||
        (x > 288 && (y < 153 || y > 257))
      )
      const factor = borde ? 0.78 : 1
      filas[p++] = Math.round(color[0] * factor)
      filas[p++] = Math.round(color[1] * factor)
      filas[p++] = Math.round(color[2] * factor)
      filas[p++] = dentro ? 255 : 0
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(ancho, 0)
  ihdr.writeUInt32BE(alto, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(filas)),
    trozo('IEND', Buffer.alloc(0)),
  ])
}
