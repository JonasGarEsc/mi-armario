// Prueba de navegador de Perletta contra un Supabase falso y un Open-Meteo
// falso. Se ejecuta con `npm run test:e2e`; no forma parte de `npm test`.
//
// Usa el Edge ya instalado (channel 'msedge'): playwright-core no descarga
// navegadores. Además de recorrer los flujos, deja las capturas del README en
// docs/capturas y falla ante cualquier error de consola o excepción.

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { crearSupabaseFalso, CORREO, CONTRASENA } from './supabase-falso.js'
import { climaFalso } from './clima-falso.js'
import { crearPngPrenda } from './png.js'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CAPTURAS = path.join(RAIZ, 'docs', 'capturas')
const BASE_CLIMA = 'https://api.open-meteo.com'
const GEO_CLIMA = 'https://geocoding-api.open-meteo.com'
const ARCHIVO_CLIMA = 'https://archive-api.open-meteo.com'

const externas = []
const errores = []
const pasos = []

function log(mensaje) {
  console.log(`· ${mensaje}`)
}

async function paso(nombre, fn) {
  const inicio = Date.now()
  try {
    await fn()
    pasos.push(nombre)
    log(`${nombre} (${Date.now() - inicio} ms)`)
  } catch (error) {
    errores.push(`${nombre}: ${error.message}`)
    throw error
  }
}

async function puertoLibre() {
  return new Promise((resolver, rechazar) => {
    const servidor = net.createServer()
    servidor.once('error', rechazar)
    servidor.listen(0, '127.0.0.1', () => {
      const { port } = servidor.address()
      servidor.close(() => resolver(port))
    })
  })
}

async function esperarUrl(url, limite = 40000) {
  const fin = Date.now() + limite
  while (Date.now() < fin) {
    try {
      const r = await fetch(url)
      if (r.ok || r.status === 404) return
    } catch { /* todavía arrancando */ }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`Vite no respondió en ${url}`)
}

function arrancarVite(puerto, supabaseFalso) {
  const proceso = spawn(process.execPath, [
    path.join(RAIZ, 'node_modules', 'vite', 'bin', 'vite.js'),
    '--host', '127.0.0.1',
    '--port', String(puerto),
    '--strictPort',
  ], {
    cwd: RAIZ,
    env: {
      ...process.env,
      VITE_SUPABASE_URL: supabaseFalso,
      VITE_SUPABASE_ANON_KEY: 'clave-publica-falsa',
      VITE_VAPID_PUBLICA: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let salida = ''
  proceso.stdout.on('data', (d) => { salida += d })
  proceso.stderr.on('data', (d) => { salida += d })
  return { proceso, salida: () => salida }
}

function esLocal(url) {
  return url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]'
}

async function main() {
  await fs.mkdir(CAPTURAS, { recursive: true })
  const temporales = await fs.mkdtemp(path.join(os.tmpdir(), 'perletta-e2e-'))
  const fotoSubida = path.join(temporales, 'camiseta.png')
  await fs.writeFile(fotoSubida, crearPngPrenda([70, 96, 140]))

  const falso = await crearSupabaseFalso()
  const puerto = await puertoLibre()
  const appUrl = `http://127.0.0.1:${puerto}`
  const vite = arrancarVite(puerto, falso.url)
  let navegador = null

  try {
    await esperarUrl(appUrl)
    navegador = await chromium.launch({ channel: 'msedge', headless: true })
    const contexto = await navegador.newContext({
      viewport: { width: 390, height: 844 },
      screen: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      colorScheme: 'light',
      reducedMotion: 'reduce',
      locale: 'es-ES',
      timezoneId: 'Europe/Madrid',
      acceptDownloads: true,
      geolocation: { latitude: 40.4168, longitude: -3.7038 },
      permissions: ['geolocation'],
    })

    await contexto.route('**/*', async (ruta) => {
      const url = new URL(ruta.request().url())
      if (esLocal(url)) return ruta.continue()
      if ([BASE_CLIMA, GEO_CLIMA, ARCHIVO_CLIMA].some((base) => url.origin === base)) {
        return ruta.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
          body: JSON.stringify(climaFalso(url.href)),
        })
      }
      externas.push(url.href)
      return ruta.fulfill({ status: 204, body: '' })
    })

    const pagina = await contexto.newPage()
    pagina.setDefaultTimeout(20000)
    pagina.on('console', (mensaje) => {
      if (mensaje.type() === 'error') errores.push(`consola: ${mensaje.text()}`)
    })
    pagina.on('pageerror', (error) => errores.push(`excepción: ${error.stack || error.message}`))
    pagina.on('response', (respuesta) => {
      if (respuesta.status() >= 400) errores.push(`respuesta ${respuesta.status()}: ${respuesta.url()}`)
    })
    pagina.on('requestfailed', (peticion) => {
      const url = new URL(peticion.url())
      if (esLocal(url)) errores.push(`petición local fallida: ${peticion.url()} (${peticion.failure()?.errorText})`)
    })

    const dialogo = () => pagina.getByRole('dialog')
    const nav = (nombre) => pagina.locator('nav[aria-label="Secciones"]:visible').getByRole('button', { name: nombre, exact: true })
    const buscador = () => pagina.getByRole('searchbox', { name: 'Buscar prendas' })
    const arriba = (seccion) => pagina.evaluate((nombre) => {
      const el = document.querySelector(`section[aria-label="${nombre}"]`)
      if (el) el.scrollTop = 0
      const hoja = document.querySelector('[data-hoja-contenido]')
      if (hoja) hoja.scrollTop = 0
    }, seccion)

    await paso('entrar con la contraseña falsa', async () => {
      await pagina.goto(appUrl, { waitUntil: 'domcontentloaded' })
      await pagina.getByRole('heading', { name: 'Tu armario, solo tuyo.' }).waitFor()
      await pagina.locator('#email').fill(CORREO)
      await pagina.locator('#password').fill(CONTRASENA)
      await pagina.getByRole('button', { name: 'Entrar', exact: true }).click()
      await pagina.getByRole('tab', { name: 'Mi ropa' }).waitFor()
    })

    await paso('armario con miniaturas visibles', async () => {
      await pagina.waitForFunction(() => {
        const visibles = [...document.querySelectorAll('section[aria-label="Armario"] img')]
          .filter((img) => img.offsetParent !== null)
        return visibles.length >= 4 && visibles.slice(0, 4).every((img) => img.complete && img.naturalWidth > 0)
      })
      const imagenes = await pagina.locator('section[aria-label="Armario"] img').evaluateAll((lista) =>
        lista.filter((img) => img.offsetParent !== null).slice(0, 4).map((img) => ({ ancho: img.naturalWidth, alto: img.naturalHeight })))
      assert.ok(imagenes.every((img) => img.ancho > 0 && img.alto > 0), 'las miniaturas no tienen píxeles')
      await arriba('Armario')
      await pagina.screenshot({ path: path.join(CAPTURAS, 'movil-armario-claro.png') })
    })

    await paso('abrir la ficha y volver con Atrás', async () => {
      await pagina.getByRole('button', { name: 'Abrir la ficha de Camiseta blanca', exact: true }).click()
      await dialogo().waitFor()
      await dialogo().getByRole('heading', { name: 'Camiseta blanca' }).waitFor()
      await dialogo().locator('img').first().evaluate((img) => img.complete && img.naturalWidth > 0)
      await pagina.waitForTimeout(250)
      await arriba('Armario')
      await pagina.screenshot({ path: path.join(CAPTURAS, 'movil-ficha-claro.png') })
      await pagina.goBack({ timeout: 8000, waitUntil: 'commit' }).catch(() => null)
      await dialogo().waitFor({ state: 'detached' })
    })

    await paso('pulsación larga: abre el menú y soltar no ejecuta nada', async () => {
      const boton = pagina.getByRole('button', { name: 'Abrir la ficha de Vaqueros rectos', exact: true })
      await boton.scrollIntoViewIfNeeded()
      const caja = await boton.boundingBox()
      assert.ok(caja, 'no se encontró la tarjeta')
      const cliente = await contexto.newCDPSession(pagina)
      await cliente.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: Math.round(caja.x + caja.width / 2), y: Math.round(caja.y + caja.height / 2), id: 1, radiusX: 2, radiusY: 2, force: 1 }],
      })
      await pagina.getByRole('button', { name: 'Editar Vaqueros rectos', exact: true }).waitFor()
      await pagina.waitForTimeout(150)
      await cliente.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await pagina.waitForTimeout(400)
      assert.equal(await dialogo().count(), 0, 'soltar después de la pulsación larga abrió la ficha')
      assert.equal(await pagina.getByRole('button', { name: 'Editar Vaqueros rectos', exact: true }).count(), 1, 'el menú se cerró al soltar')
      await pagina.keyboard.press('Escape')
      await pagina.getByRole('button', { name: 'Editar Vaqueros rectos', exact: true }).waitFor({ state: 'detached' })
    })

    await paso('editar conservando la búsqueda', async () => {
      await buscador().fill('Camiseta')
      await pagina.getByRole('button', { name: 'Abrir la ficha de Camiseta blanca', exact: true }).waitFor()
      await pagina.getByRole('button', { name: 'Abrir la ficha de Camiseta blanca', exact: true }).click()
      await dialogo().getByRole('button', { name: 'Editar Camiseta blanca', exact: true }).click()
      await dialogo().getByRole('heading', { name: 'Editar prenda' }).waitFor()
      await dialogo().locator('#nombrePrenda').fill('Camiseta blanca de lino')
      await dialogo().getByRole('button', { name: 'Actualizar', exact: true }).click()
      await dialogo().waitFor({ state: 'detached' })
      await pagina.getByRole('button', { name: 'Abrir la ficha de Camiseta blanca de lino', exact: true }).waitFor()
      assert.equal(await buscador().inputValue(), 'Camiseta', 'la búsqueda se perdió al guardar')
      await buscador().fill('')
      await pagina.getByRole('button', { name: 'Abrir la ficha de Jersey gris', exact: true }).waitFor()
    })

    await paso('borrar y deshacer', async () => {
      await pagina.getByRole('button', { name: 'Opciones de Jersey gris', exact: true }).click()
      await pagina.getByRole('button', { name: 'Eliminar Jersey gris', exact: true }).click()
      const aviso = pagina.getByRole('alertdialog')
      await aviso.waitFor()
      await aviso.getByRole('button', { name: 'Eliminar', exact: true }).click()
      await pagina.getByRole('button', { name: 'Deshacer', exact: true }).waitFor()
      assert.equal(await pagina.getByRole('button', { name: 'Abrir la ficha de Jersey gris', exact: true }).count(), 0, 'la prenda no desapareció')
      await pagina.getByRole('button', { name: 'Deshacer', exact: true }).click()
      await pagina.getByText('Prenda recuperada', { exact: true }).waitFor()
      await pagina.getByRole('button', { name: 'Abrir la ficha de Jersey gris', exact: true }).waitFor()
    })

    await paso('añadir una prenda sin recorte con IA', async () => {
      await arriba('Armario')
      await pagina.getByRole('button', { name: 'Añadir prenda', exact: true }).click()
      await dialogo().getByRole('heading', { name: 'Añadir prenda' }).waitFor()
      const quitarFondo = dialogo().locator('#toggleFondo')
      assert.equal(await quitarFondo.isChecked(), false, 'el recorte con IA no debe estar activo')
      await dialogo().locator('#imagen').setInputFiles(fotoSubida)
      await dialogo().locator('#nombrePrenda').fill('Camiseta de prueba')
      await dialogo().locator('#tipoPrenda').selectOption({ label: 'Parte de arriba' })
      await dialogo().locator('#categoria').selectOption({ label: 'Camisetas' })
      await dialogo().getByRole('button', { name: 'Guardar prenda', exact: true }).click()
      await dialogo().waitFor({ state: 'detached' })
      await pagina.getByText('Prenda añadida', { exact: true }).waitFor()
      await pagina.getByRole('button', { name: 'Abrir la ficha de Camiseta de prueba', exact: true }).waitFor()
    })

    await paso('crear un outfit con dos prendas', async () => {
      await pagina.getByRole('button', { name: 'Seleccionar Camiseta blanca de lino', exact: true }).click()
      // Con una prenda ya seleccionada, la foto y la casilla comparten etiqueta:
      // se pulsa la casilla (la segunda del DOM), no la foto.
      await pagina.getByRole('button', { name: 'Seleccionar Falda de lino', exact: true }).last().click()
      await pagina.getByRole('button', { name: 'Crear outfit con 2 prendas', exact: true }).click()
      await dialogo().getByRole('heading', { name: 'Guardar outfit' }).waitFor()
      await dialogo().locator('#nombreConjunto').fill('Look de prueba')
      await dialogo().getByRole('button', { name: 'Guardar', exact: true }).click()
      await pagina.getByText('Outfit guardado', { exact: true }).waitFor()
      // La selección no puede seguir activa al volver al armario.
      await pagina.getByRole('button', { name: 'Crear outfit con 2 prendas', exact: true, includeHidden: true }).waitFor({ state: 'detached' })
      await pagina.getByText('París', { exact: true }).first().waitFor()
    })

    await paso('flujo de maleta: abrir, preparar, guardar y lista', async () => {
      await pagina.getByRole('button', { name: 'Abrir París', exact: true }).click()
      await pagina.getByRole('button', { name: 'Volver a las maletas', exact: true }).waitFor()
      await pagina.getByText('Look de prueba', { exact: true }).waitFor()
      await pagina.getByRole('button', { name: 'Prepárala por mí', exact: true }).click()
      await dialogo().getByRole('heading', { name: 'Prepara «París»' }).waitFor()
      const preparar = dialogo().getByRole('button', { name: 'Preparar la maleta', exact: true })
      await preparar.waitFor()
      await preparar.click()
      await dialogo().getByText(/^\d+ prendas → \d+ outfits$/).waitFor()
      await dialogo().getByRole('button', { name: 'Guardar en la maleta', exact: true }).click()
      await dialogo().waitFor({ state: 'detached' })
      await pagina.getByText(/Maleta preparada:/).waitFor()
      await pagina.waitForTimeout(3800)

      const lista = pagina.getByRole('button', { name: /Lista de la maleta/ })
      await lista.click()
      const anadir = pagina.getByRole('textbox', { name: 'Añadir a la lista' })
      await anadir.fill('Paraguas')
      await pagina.getByRole('button', { name: 'Añadir', exact: true }).click()
      await pagina.getByText('Paraguas', { exact: true }).waitFor()
      await lista.click()
      await arriba('Maletas')
      await pagina.screenshot({ path: path.join(CAPTURAS, 'movil-maleta-claro.png') })
    })

    await paso('Hoy: me gusta y «Me lo pongo»', async () => {
      await nav('Hoy').click()
      await dialogo().getByRole('heading', { name: 'Hoy' }).waitFor()
      const propuesta = dialogo().getByRole('article', { name: 'Propuesta de hoy' })
      await propuesta.waitFor()
      await dialogo().getByText(/Hoy( en [^:]+)?: \d+° – \d+°/).waitFor()
      const gusta = propuesta.getByRole('button', { name: 'Me gusta', exact: true })
      await gusta.click()
      await pagina.locator('button[aria-pressed="true"]', { hasText: 'Me gusta' }).waitFor()
      await arriba(null)
      await pagina.screenshot({ path: path.join(CAPTURAS, 'movil-hoy-claro.png') })
      await propuesta.getByRole('button', { name: 'Me lo pongo', exact: true }).click()
      await pagina.getByText(/guardado en tu semana|ya estaba en tu semana/).waitFor()
      await dialogo().waitFor({ state: 'detached' })

      await nav('Hoy').click()
      await dialogo().getByRole('article', { name: 'Outfit planificado para hoy' }).waitFor()
      await dialogo().getByRole('heading', { name: 'Hoy' }).waitFor()
      await dialogo().getByRole('button', { name: 'Cerrar', exact: true }).click()
      await dialogo().waitFor({ state: 'detached' })
    })

    await paso('Ajustes: exportar copia y tema oscuro', async () => {
      await pagina.getByRole('button', { name: 'Ajustes', exact: true }).click()
      await dialogo().getByRole('heading', { name: 'Ajustes' }).waitFor()
      const [descarga] = await Promise.all([
        pagina.waitForEvent('download'),
        dialogo().getByRole('button', { name: /Descargar copia de seguridad/ }).click(),
      ])
      assert.match(descarga.suggestedFilename(), /^perletta-\d{4}-\d{2}-\d{2}\.json$/)
      const rutaCopia = path.join(temporales, 'copia.json')
      await descarga.saveAs(rutaCopia)
      const copia = JSON.parse(await fs.readFile(rutaCopia, 'utf8'))
      assert.ok(Array.isArray(copia.prendas) && copia.prendas.length >= 10, 'la copia no trae las prendas')
      assert.ok(Array.isArray(copia.conjuntos) && copia.conjuntos.length >= 3, 'la copia no trae los outfits')

      // Descargar la copia cierra Ajustes: se vuelve a abrir para el tema.
      await dialogo().waitFor({ state: 'detached' })
      await pagina.getByRole('button', { name: 'Ajustes', exact: true }).click()
      await dialogo().getByRole('heading', { name: 'Ajustes' }).waitFor()
      const tema = dialogo().getByRole('switch', { name: 'Tema oscuro', exact: true })
      await tema.click()
      assert.equal(await tema.getAttribute('aria-checked'), 'true')
      await dialogo().getByRole('button', { name: 'Cerrar', exact: true }).click()
      await dialogo().waitFor({ state: 'detached' })
      await pagina.getByText('Copia descargada', { exact: true }).waitFor({ state: 'detached' })
      await nav('Armario').click()
      // La selección de prendas sigue viva al cambiar de pestaña; para la foto
      // del README se quita, y así se comprueba que el botón funciona.
      const quitarSeleccion = pagina.getByRole('button', { name: 'Quitar la selección', exact: true })
      if (await quitarSeleccion.count()) {
        await quitarSeleccion.click()
        await quitarSeleccion.waitFor({ state: 'detached' })
      }
      await arriba('Armario')
      await pagina.screenshot({ path: path.join(CAPTURAS, 'movil-armario-oscuro.png') })
    })

    await paso('los datos del Supabase falso reflejan los flujos', async () => {
      const { datos } = falso
      assert.ok(datos.prendas.some((p) => p.nombre === 'Camiseta blanca de lino'))
      assert.ok(datos.prendas.some((p) => p.nombre === 'Camiseta de prueba'))
      assert.ok(datos.conjuntos.some((c) => c.nombre === 'Look de prueba'))
      assert.ok(datos.conjuntos.some((c) => c.semana_id && c.fecha))
      assert.ok(datos.maleta_extras.some((e) => e.texto === 'Paraguas'))
      assert.ok(datos.usos.length > 4, '«Me lo pongo» no anotó los usos')
      assert.ok(datos.valoraciones.some((v) => v.valor === 1))
    })

    assert.deepEqual(externas, [], `se intentaron abrir hosts externos: ${externas.join(', ')}`)
    assert.deepEqual(errores, [], `errores de consola o excepciones:\n${errores.join('\n')}`)

    console.log(`\nOK: ${pasos.length} pasos. Capturas en docs/capturas/.`)
  } finally {
    await navegador?.close().catch(() => {})
    vite.proceso.kill()
    await falso.cerrar()
    await fs.rm(temporales, { recursive: true, force: true })
    if (errores.length) {
      console.error(`\nFallos:\n${errores.map((e) => `- ${e}`).join('\n')}`)
    }
  }
}

main().catch((error) => {
  console.error(error.stack || error.message)
  process.exitCode = 1
})
