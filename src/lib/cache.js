const PREFIJO = 'armario_v2_'

export function leerCache(clave) {
  try {
    return JSON.parse(localStorage.getItem(PREFIJO + clave))
  } catch {
    localStorage.removeItem(PREFIJO + clave)
    return null
  }
}

export function guardarCache(clave, valor) {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor))
  } catch {
    // Cuota llena o modo privado: la caché es solo una mejora, se ignora.
  }
}
