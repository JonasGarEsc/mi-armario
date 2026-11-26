// Subida masiva de fotos: una cola que va preparando cada foto en segundo plano
// (comprimir, recortar el fondo, colores y etiquetas con IA) mientras sigues usando la
// app. Esta parte es lógica pura: los pasos reales se le inyectan, así se puede probar.

const ESTADOS_ACTIVOS = ['cola', 'preparando', 'analizando']

/** «IMG_2041.jpg» → «IMG 2041». */
export function nombreDesdeArchivo(nombre) {
  return String(nombre || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
}

/** Resumen del estado de la cola, para el indicador y los textos. */
export function resumenCarga(items) {
  const cuenta = (e) => items.filter((i) => i.estado === e).length
  const activas = items.filter((i) => ESTADOS_ACTIVOS.includes(i.estado)).length
  return {
    total: items.length,
    activas,
    listas: cuenta('lista'),
    errores: cuenta('error'),
    terminadas: items.length - activas,
  }
}

/**
 * Cola de fotos. `pasos`:
 *  - preparar(archivo, { quitarFondo, onEstado }) → Blob
 *  - analizar(foto) → { color, sugerencia }
 *  - vistaPrevia(foto) → URL (opcional)   - liberar(url) (opcional)
 * Se procesa de una en una: el recorte de fondo es pesado y en móvil no conviene en paralelo.
 */
export function crearCargaMasiva({ pasos }) {
  let items = []
  let numero = 0
  let trabajando = false
  const oyentes = new Set()

  const avisar = () => { items = [...items]; oyentes.forEach((f) => f()) }
  const cambiar = (id, cambios) => {
    items = items.map((i) => (i.id === id ? { ...i, ...cambios } : i))
    avisar()
  }

  async function procesar(item) {
    const hecho = () => items.some((i) => i.id === item.id) // por si se descartó mientras tanto
    cambiar(item.id, { estado: 'preparando', mensaje: 'Preparando la foto…' })
    try {
      const foto = await pasos.preparar(item.archivo, {
        quitarFondo: item.quitarFondo,
        onEstado: (mensaje) => { if (hecho()) cambiar(item.id, { mensaje }) },
      })
      if (!hecho()) return
      cambiar(item.id, { estado: 'analizando', mensaje: 'Mirando la prenda…', foto, vistaPrevia: pasos.vistaPrevia?.(foto) ?? null })
      const { color, sugerencia } = await pasos.analizar(foto)
      if (!hecho()) return
      cambiar(item.id, {
        estado: 'lista', mensaje: '', color: color || null, sugerencia: sugerencia || null,
        nombre: sugerencia?.nombre || nombreDesdeArchivo(item.archivo.name),
      })
    } catch (error) {
      if (hecho()) cambiar(item.id, { estado: 'error', mensaje: error?.message || 'No se pudo preparar la foto.' })
    }
  }

  async function trabajar() {
    if (trabajando) return
    trabajando = true
    try {
      for (let item = items.find((i) => i.estado === 'cola'); item; item = items.find((i) => i.estado === 'cola')) {
        await procesar(item)
      }
    } finally {
      trabajando = false
    }
  }

  return {
    obtener: () => items,
    suscribir(f) { oyentes.add(f); return () => oyentes.delete(f) },

    /** Añade fotos a la cola y empieza a procesarlas. Devuelve los ids. */
    encolar(archivos, { quitarFondo = false } = {}) {
      const nuevos = [...archivos].map((archivo) => ({
        id: `foto-${++numero}`, archivo, quitarFondo, estado: 'cola', mensaje: 'En cola',
        nombre: '', foto: null, vistaPrevia: null, sugerencia: null, color: null, tipoId: '', categoriaId: '', pista: '', clasificada: false,
      }))
      items = [...items, ...nuevos]
      avisar()
      trabajar()
      return nuevos.map((n) => n.id)
    },

    /** Cambios del usuario en la revisión (nombre, tipo, categoría...). */
    editar: (id, cambios) => cambiar(id, cambios),

    reintentar(id) {
      cambiar(id, { estado: 'cola', mensaje: 'En cola' })
      trabajar()
    },

    descartar(id) {
      const item = items.find((i) => i.id === id)
      if (item?.vistaPrevia) pasos.liberar?.(item.vistaPrevia)
      items = items.filter((i) => i.id !== id)
      avisar()
    },

    /** Quita las ya guardadas (o todas). */
    quitar(ids) {
      const fuera = new Set(ids)
      for (const i of items) if (fuera.has(i.id) && i.vistaPrevia) pasos.liberar?.(i.vistaPrevia)
      items = items.filter((i) => !fuera.has(i.id))
      avisar()
    },
  }
}
