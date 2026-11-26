import { useEffect, useRef, useState } from 'react'
import { urlImagen } from '../lib/imagenes'
import {
  agregarAlHistorial, fotoDesdeUrl, medidasDeLienzo, puntoDePincel, puntosDelTrazo, radioDePincel,
} from '../lib/retoque'

const TAMANO_INICIAL = 40

/**
 * Pincel de borrar y recuperar sobre la foto. Se carga con React.lazy desde
 * FormularioEdicion: solo pesa cuando hace falta.
 */
export default function RetoqueRecorte({ url, archivo = null, onAplicar, onCancelar }) {
  const lienzo = useRef(null)
  const original = useRef(null)
  const trazo = useRef(null)
  const historial = useRef([])
  const [listo, setListo] = useState(false)
  const [error, setError] = useState('')
  const [modo, setModo] = useState('borrar')
  const [tamano, setTamano] = useState(TAMANO_INICIAL)
  const [puedeDeshacer, setPuedeDeshacer] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let vivo = true
    let objeto = null
    setListo(false)
    setError('')
    setPuedeDeshacer(false)
    historial.current = []
    trazo.current = null

    const carga = archivo ? Promise.resolve(archivo) : fotoDesdeUrl(url, 1200, urlImagen)
    carga
      .then((foto) => {
        if (!vivo) return
        objeto = URL.createObjectURL(foto)
        const imagen = new Image()
        imagen.decoding = 'async'
        imagen.onload = () => {
          if (!vivo || !lienzo.current || !original.current) return
          const { ancho, alto } = medidasDeLienzo(imagen.naturalWidth, imagen.naturalHeight)
          for (const canvas of [lienzo.current, original.current]) {
            canvas.width = ancho
            canvas.height = alto
          }
          const ctxOriginal = original.current.getContext('2d')
          const ctx = lienzo.current.getContext('2d')
          if (!ctxOriginal || !ctx) {
            setError('No se pudo preparar el lienzo.')
            return
          }
          ctxOriginal.drawImage(imagen, 0, 0, ancho, alto)
          ctx.drawImage(imagen, 0, 0, ancho, alto)
          URL.revokeObjectURL(objeto)
          objeto = null
          setListo(true)
        }
        imagen.onerror = () => {
          if (vivo) setError('No se pudo abrir la foto.')
        }
        imagen.src = objeto
      })
      .catch((fallo) => {
        if (vivo) setError(fallo.message || 'No se pudo cargar la foto.')
      })

    return () => {
      vivo = false
      if (objeto) URL.revokeObjectURL(objeto)
    }
  }, [url, archivo])

  function pintar(desde, hasta) {
    const canvas = lienzo.current
    const fuente = original.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !fuente || !ctx) return

    const rect = canvas.getBoundingClientRect()
    const radio = radioDePincel(tamano, canvas.width, rect.width)
    const puntos = puntosDelTrazo(desde.x, desde.y, hasta.x, hasta.y, Math.max(1, radio / 2))

    ctx.save()
    ctx.beginPath()
    for (const [x, y] of puntos) {
      ctx.moveTo(x + radio, y)
      ctx.arc(x, y, radio, 0, Math.PI * 2)
    }
    if (modo === 'borrar') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fill()
    } else {
      ctx.clip()
      ctx.drawImage(fuente, 0, 0)
    }
    ctx.restore()
  }

  function alBajar(e) {
    if (!listo || trazo.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    const canvas = lienzo.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    e.preventDefault()
    e.stopPropagation()
    try { canvas.setPointerCapture(e.pointerId) } catch { /* sin captura se pinta igual */ }

    historial.current = agregarAlHistorial(
      historial.current,
      ctx.getImageData(0, 0, canvas.width, canvas.height),
    )
    setPuedeDeshacer(true)

    const punto = puntoDePincel(e.clientX, e.clientY, canvas.getBoundingClientRect(), canvas.width, canvas.height)
    trazo.current = { id: e.pointerId, anterior: punto }
    pintar(punto, punto)
  }

  function alMover(e) {
    const actual = trazo.current
    const canvas = lienzo.current
    if (!actual || actual.id !== e.pointerId || !canvas) return
    e.preventDefault()
    const punto = puntoDePincel(e.clientX, e.clientY, canvas.getBoundingClientRect(), canvas.width, canvas.height)
    pintar(actual.anterior, punto)
    actual.anterior = punto
  }

  function alSoltar(e) {
    if (!trazo.current || trazo.current.id !== e.pointerId) return
    trazo.current = null
    try { lienzo.current?.releasePointerCapture(e.pointerId) } catch { /* ya se soltó */ }
  }

  function deshacer() {
    const canvas = lienzo.current
    if (!canvas || historial.current.length === 0) return
    const anterior = historial.current[historial.current.length - 1]
    historial.current = historial.current.slice(0, -1)
    canvas.getContext('2d').putImageData(anterior, 0, 0)
    setPuedeDeshacer(historial.current.length > 0)
  }

  async function aplicar() {
    const canvas = lienzo.current
    if (!canvas || !listo || guardando) return
    setGuardando(true)
    setError('')
    try {
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((valor) => (valor ? resolve(valor) : reject(new Error('No se pudo preparar el retoque.'))), 'image/png')
      })
      onAplicar(new File([blob], 'retoque.png', { type: 'image/png' }))
    } catch (fallo) {
      setError(fallo.message || 'No se pudo preparar el retoque.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section aria-label="Retocar la foto a mano" className="flex flex-col gap-3 rounded-xl border border-linea bg-lamina/60 p-3">
      <h3 className="font-semibold">Retoque a mano</h3>
      <p className="text-sm text-tenue -mt-1">Pinta sobre la foto para borrar el fondo que sobre o recuperarlo.</p>

      {error && <div role="alert" className="aviso-error">{error}</div>}

      <div className="relative flex justify-center">
        {!listo && !error && <div role="status" aria-label="Cargando foto" className="esqueleto h-64 w-full" />}
        <canvas
          ref={lienzo}
          role="img"
          aria-label="Lienzo de retoque: pinta sobre la foto"
          className={`h-auto max-h-[46dvh] w-auto max-w-full touch-none select-none rounded-lg bg-foto ${listo ? 'block' : 'hidden'}`}
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
        />
      </div>

      <div role="group" aria-label="Pincel" className="grid grid-cols-2 gap-2">
        <button type="button" aria-pressed={modo === 'borrar'} onClick={() => setModo('borrar')} className={`boton min-h-11! text-sm! ${modo === 'borrar' ? 'boton-primario' : 'boton-secundario'}`}>
          Borrar
        </button>
        <button type="button" aria-pressed={modo === 'recuperar'} onClick={() => setModo('recuperar')} className={`boton min-h-11! text-sm! ${modo === 'recuperar' ? 'boton-primario' : 'boton-secundario'}`}>
          Recuperar
        </button>
      </div>

      <div>
        <label htmlFor="tamanoPincel" className="etiqueta">Tamaño del pincel</label>
        <input
          id="tamanoPincel"
          type="range"
          min="8"
          max="120"
          step="2"
          value={tamano}
          onChange={(e) => setTamano(Number(e.target.value))}
          className="min-h-11 w-full accent-acento"
        />
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={deshacer} disabled={!puedeDeshacer} className="boton boton-secundario flex-1 min-h-11! text-sm!">
          Deshacer
        </button>
        <button type="button" onClick={onCancelar} className="boton boton-secundario flex-1 min-h-11! text-sm!">
          Cancelar
        </button>
      </div>
      <button type="button" onClick={aplicar} disabled={!listo || guardando} className="boton boton-primario w-full">
        {guardando ? 'Preparando…' : 'Usar esta foto'}
      </button>

      <canvas ref={original} className="hidden" aria-hidden="true" />
    </section>
  )
}
