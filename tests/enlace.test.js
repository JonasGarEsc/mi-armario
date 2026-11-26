import test from 'node:test'
import assert from 'node:assert/strict'
import {
  aPrecio, esDireccionProhibida, extraerDatos, nombreProhibido, urlAbsoluta, validarUrl,
} from '../supabase/functions/leer-enlace/enlace.js'
import { archivoDeBase64, datosDeEnlace } from '../src/lib/enlace.js'

test('del enlace solo se aceptan https al puerto por defecto y sin credenciales', () => {
  assert.equal(validarUrl('http://tienda.example/x'), null)
  assert.equal(validarUrl('ftp://tienda.example/x'), null)
  assert.equal(validarUrl('javascript:alert(1)'), null)
  assert.equal(validarUrl('https://tienda.example:8443/x'), null)
  assert.equal(validarUrl('https://usuario:clave@tienda.example/x'), null)
  assert.equal(validarUrl(''), null)
  assert.equal(validarUrl('no es una url'), null)

  assert.equal(validarUrl('https://tienda.example/producto?x=1').host, 'tienda.example')
  assert.equal(validarUrl('https://tienda.example:443/producto').host, 'tienda.example')
  assert.equal(validarUrl('https://tienda.example/producto').url.href, 'https://tienda.example/producto')
})

test('se rechazan localhost, nombres internos y literales de IP no públicas', () => {
  for (const nombre of ['localhost', 'localhost.', 'caja.local', 'algo.localhost', 'svc.internal']) {
    assert.equal(nombreProhibido(nombre), true, nombre)
    assert.equal(validarUrl(`https://${nombre}/`), null, nombre)
  }
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.0.1', '169.254.169.254', '100.64.0.1', '224.0.0.1', '0.0.0.0']) {
    assert.equal(validarUrl(`https://${ip}/`), null, ip)
  }
  for (const ip of ['[::1]', '[::]', '[fe80::1]', '[fd12::1]', '[ff02::1]', '[::ffff:192.168.1.1]']) {
    assert.equal(validarUrl(`https://${ip}/`), null, ip)
  }
})

test('la clasificación de IP cubre privadas, loopback, CGNAT, multicast y mapeadas', () => {
  for (const ip of [
    '127.0.0.1', '10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '100.127.255.255', '0.0.0.0', '224.0.0.1', '255.255.255.255',
    '::', '::1', 'fe80::1', 'fd12::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:192.168.0.1', 'no-es-ip',
  ]) {
    assert.equal(esDireccionProhibida(ip), true, ip)
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1', '2001:4860:4860::8888', '::ffff:8.8.8.8']) {
    assert.equal(esDireccionProhibida(ip), false, ip)
  }
})

test('extrae og:title, og:image y el precio de las meta etiquetas', () => {
  const html = `<!doctype html><html><head>
    <meta property="og:title" content="Camiseta &amp; falda" />
    <meta property="og:image" content="/img/camisa.webp" />
    <meta property="product:price:amount" content="29.95" />
  </head></html>`
  assert.deepEqual(extraerDatos(html, 'https://tienda.example/p/1'), {
    nombre: 'Camiseta & falda',
    precio: 29.95,
    imagen: 'https://tienda.example/img/camisa.webp',
  })
})

test('si no hay meta de precio se usa el JSON-LD de ofertas', () => {
  const html = `<html><head><title>Bufanda | Tienda</title>
    <meta property="og:title" content="Bufanda de lana" />
    <script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","price":"19,90","priceCurrency":"EUR"}}</script>
  </head></html>`
  assert.deepEqual(extraerDatos(html, 'https://tienda.example/p/2'), {
    nombre: 'Bufanda de lana',
    precio: 19.9,
    imagen: null,
  })
})

test('og:price:amount y un JSON-LD roto no rompen la lectura', () => {
  const html = `<html><head>
    <meta property="og:price:amount" content="1.299,00" />
    <script type="application/ld+json">{roto</script>
  </head></html>`
  assert.deepEqual(extraerDatos(html, 'https://tienda.example/p/3'), { nombre: null, precio: 1299, imagen: null })
})

test('una página sin datos devuelve nulos y los precios raros se descartan', () => {
  assert.deepEqual(extraerDatos('', ''), { nombre: null, precio: null, imagen: null })
  assert.equal(aPrecio('gratis'), null)
  assert.equal(aPrecio(-3), null)
  assert.equal(aPrecio('0'), 0)
  assert.equal(aPrecio('1,299.00'), 1299)
  assert.equal(urlAbsoluta('//cdn.example/foto.png', 'https://tienda.example/x'), 'https://cdn.example/foto.png')
  assert.equal(urlAbsoluta('', 'https://tienda.example/x'), null)
})

test('la respuesta de la función se convierte en nombre, precio y foto', () => {
  const datos = datosDeEnlace({
    nombre: '  Camiseta   negra ',
    precio: '29,95',
    imagen_base64: btoa('foto'),
    tipo_mime: 'image/webp',
  })
  assert.equal(datos.nombre, 'Camiseta negra')
  assert.equal(datos.precio, 29.95)
  assert.equal(datos.foto.type, 'image/webp')
  assert.equal(datos.foto.name, 'enlace.webp')

  assert.equal(datosDeEnlace(null), null)
  assert.equal(datosDeEnlace({}), null)
  assert.equal(datosDeEnlace({ nombre: null, precio: null, imagen_base64: null, tipo_mime: null }), null)
  assert.equal(archivoDeBase64(btoa('x'), 'image/svg+xml'), null)
  assert.equal(archivoDeBase64('', 'image/png'), null)
  assert.equal(archivoDeBase64(btoa('x'), 'image/png').name, 'enlace.png')
})
