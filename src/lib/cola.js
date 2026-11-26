// Cola de tareas con límite de concurrencia, progreso y cancelación.
// Sirve para etiquetar el armario (3 a la vez) y para la subida masiva de fotos.

/**
 * Ejecuta `tarea(item, indice)` para cada elemento, con como mucho `concurrencia`
 * a la vez. La tarea devuelve false (o lanza) si ha fallado; el resto cuenta como bien.
 * `signal` (AbortSignal) detiene la cola: lo ya en marcha termina y no empieza nada más.
 */
export async function procesarEnCola(items, tarea, { concurrencia = 3, onProgreso = () => {}, signal } = {}) {
  const total = items.length
  let siguiente = 0
  let hechos = 0
  let fallos = 0

  async function trabajador() {
    while (!signal?.aborted) {
      const i = siguiente++
      if (i >= total) return
      try {
        if ((await tarea(items[i], i)) === false) fallos++
      } catch {
        fallos++
      }
      hechos++
      onProgreso({ hechos, fallos, total })
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrencia, total) }, trabajador))
  return { hechos, fallos, total, cancelado: Boolean(signal?.aborted) && hechos < total }
}
