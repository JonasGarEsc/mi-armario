const PREFIJO = 'armario_v2_'

// Cada cuenta tiene su propia caché: en un móvil compartido no se cuela la ropa de otro.
let espacio = 'anon'

export function fijarEspacio(id) {
  espacio = id || 'anon'
}

export function leerCache(clave) {
  try {
    return JSON.parse(localStorage.getItem(PREFIJO + espacio + ':' + clave))
  } catch {
    localStorage.removeItem(PREFIJO + espacio + ':' + clave)
    return null
  }
}

export function guardarCache(clave, valor) {
  try {
    localStorage.setItem(PREFIJO + espacio + ':' + clave, JSON.stringify(valor))
  } catch {
    // Cuota llena o modo privado: la caché es solo una mejora, se ignora.
  }
}
