// Genera los PNG del icono desde icono-maestro.svg (vector, a su tamaño real) y comprueba el resultado.
// Uso, desde la raíz del proyecto: node docs/diseno/generar-iconos.mjs   (necesita Edge; EDGE=ruta para otro Chromium)
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert'

const maestro = readFileSync('docs/diseno/icono-maestro.svg', 'utf8')
// Maskable: mismo fondo a sangre y el dibujo reducido para caber en la zona segura (radio del 40 %).
const maskable = maestro.replace('<g id="maleta">', '<g id="maleta" transform="translate(256 256) scale(0.82) translate(-256 -256)">')
assert(maskable !== maestro)
const uri = svg => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')

const perfil = mkdtempSync(join(tmpdir(), 'iconos-'))
const edge = spawn(process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--remote-debugging-port=9388', `--user-data-dir=${perfil}`, '--no-first-run', 'about:blank'])
const espera = ms => new Promise(r => setTimeout(r, ms))
let pagina
for (let i = 0; i < 100 && !pagina; i++) {
  await espera(200)
  pagina = await fetch('http://127.0.0.1:9388/json').then(r => r.json()).then(l => l.find(t => t.type === 'page')).catch(() => null)
}
const ws = new WebSocket(pagina.webSocketDebuggerUrl)
await new Promise(r => ws.onopen = r)
let n = 0
const pend = new Map()
ws.onmessage = ({ data }) => { const m = JSON.parse(data); pend.get(m.id)?.(m.result) }
const cdp = (method, params = {}) => new Promise(r => { pend.set(++n, r); ws.send(JSON.stringify({ id: n, method, params })) })
const js = async e => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value

async function foto(ruta, ancho, alto, cuerpo) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: false })
  await js(`document.documentElement.innerHTML = ${JSON.stringify(`<body style="margin:0">${cuerpo}</body>`)}; Promise.all([...document.images].map(i => i.decode()))`)
  await espera(150)
  writeFileSync(ruta, Buffer.from((await cdp('Page.captureScreenshot')).data, 'base64'))
}
const img = (src, lado) => `<img src="${src}" width="${lado}" height="${lado}" style="display:block">`

for (const [ruta, lado, svg] of [
  ['public/icono-512.png', 512, maestro],
  ['public/icono-192.png', 192, maestro],
  ['public/apple-touch-icon.png', 180, maestro],
  ['public/icono-maskable-512.png', 512, maskable],
]) await foto(ruta, lado, lado, img(uri(svg), lado))

// Tira de prueba: los PNG reales a 512 y 180, y el favicon a 64 y 32 sobre claro y oscuro.
const png = f => 'data:image/png;base64,' + readFileSync(f).toString('base64')
const fav = uri(readFileSync('public/favicon.svg', 'utf8'))
const pestanas = fondo => `<div style="display:flex;gap:24px;align-items:center;padding:16px;background:${fondo}">${img(fav, 64)}${img(fav, 32)}</div>`
await foto('docs/diseno/icono-prueba.png', 920, 544, `<div style="display:flex;gap:24px;align-items:flex-end;padding:16px;background:#d9dbe0">${img(png('public/icono-512.png'), 512)}${img(png('public/apple-touch-icon.png'), 180)}<div>${pestanas('#ffffff')}${pestanas('#202124')}</div></div>`)

// Comprobación: sin transparencia y, en el maskable, el dibujo dentro del círculo seguro.
const soloFondo = maskable.replace(/<g id="maleta"[\s\S]*<\/g>\s*<\/svg>/, '</svg>')
const fondo = join(perfil, 'fondo.png')
await foto(fondo, 512, 512, img(uri(soloFondo), 512))
const informe = await js(`(async () => {
  const pixeles = async src => { const i = new Image(); i.src = src; await i.decode(); const c = new OffscreenCanvas(i.width, i.height).getContext('2d'); c.drawImage(i, 0, 0); return c.getImageData(0, 0, i.width, i.height) }
  const alfaMinimo = async src => { const { data } = await pixeles(src); let m = 255; for (let k = 3; k < data.length; k += 4) m = Math.min(m, data[k]); return m }
  const a = await pixeles(${JSON.stringify(png('public/icono-maskable-512.png'))}), b = await pixeles(${JSON.stringify(png(fondo))})
  let radio = 0
  for (let k = 0; k < a.data.length; k += 4) {
    if (Math.abs(a.data[k] - b.data[k]) + Math.abs(a.data[k + 1] - b.data[k + 1]) + Math.abs(a.data[k + 2] - b.data[k + 2]) > 12)
      radio = Math.max(radio, Math.hypot((k / 4) % 512 - 255.5, Math.floor(k / 4 / 512) - 255.5))
  }
  return { radioDibujoMaskable: Math.round(radio), zonaSegura: 204,
    alfaMinimo: {
      apple: await alfaMinimo(${JSON.stringify(png('public/apple-touch-icon.png'))}),
      maskable: await alfaMinimo(${JSON.stringify(png('public/icono-maskable-512.png'))}),
      i192: await alfaMinimo(${JSON.stringify(png('public/icono-192.png'))}),
      i512: await alfaMinimo(${JSON.stringify(png('public/icono-512.png'))}) } }
})()`)
console.log(informe)
await cdp('Browser.close'); edge.kill()
assert(Object.values(informe.alfaMinimo).every(a => a === 255), 'hay transparencia')
assert(informe.radioDibujoMaskable > 0 && informe.radioDibujoMaskable <= 204, 'el dibujo se sale de la zona segura')
process.exit(0)
