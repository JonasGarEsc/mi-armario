import { contarCopia, importarCopia, leerTabla } from './backup.js'
import { vibrar } from './vibrar.js'

const TABLAS = ['categorias', 'tipos', 'prendas', 'maletas', 'semanas', 'conjuntos', 'conjunto_prenda', 'usos', 'maleta_extras', 'valoraciones']

// Copia de seguridad manual: todo el armario en un JSON que se descarga.
export async function exportarDatos(supabase, mostrarToast) {
  const copia = { exportado_en: new Date().toISOString(), version: 4 }
  for (const tabla of TABLAS) {
    const { data, error } = await leerTabla(supabase, tabla)
    if (error) return mostrarToast(`No se pudo exportar ${tabla}`, 'error')
    copia[tabla] = data
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(copia, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `perletta-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  mostrarToast('Copia descargada', 'exito')
}

/** Lee el archivo elegido, cuenta lo que trae y pide confirmación antes de restaurar. */
export async function restaurarCopia(supabase, archivo, { mostrarToast, solicitarConfirmacionGlobal, recargarVistas }) {
  let crudo
  try {
    crudo = JSON.parse(await archivo.text())
  } catch {
    return mostrarToast('Ese archivo no es una copia válida', 'error')
  }

  let cuenta
  try {
    cuenta = contarCopia(crudo)
  } catch (error) {
    return mostrarToast(error.message, 'error')
  }

  solicitarConfirmacionGlobal({
    mensaje: `¿Restaurar la copia? Se añadirán ${cuenta.prendas} prendas y ${cuenta.conjuntos} outfits a lo que ya tienes.`,
    esDestructivo: false,
    textoConfirmar: 'Restaurar',
    onConfirm: async () => {
      try {
        const resumen = await importarCopia(supabase, crudo)
        vibrar([50, 50])
        mostrarToast(`Copia restaurada: ${resumen.prendas} prendas y ${resumen.conjuntos} outfits`, 'exito')
        recargarVistas()
      } catch (error) {
        mostrarToast(error.message || 'No se pudo restaurar la copia', 'error')
      }
    },
  })
}
