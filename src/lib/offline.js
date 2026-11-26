// Conexión y cola de acciones sin red de la app (ver colaOffline.js para la lógica).

import { useSyncExternalStore } from 'react'
import { supabase } from '../supabase'
import { leerCache, guardarCache } from './cache'
import { crearColaOffline, ejecutarOperacion } from './colaOffline'

const CLAVE = 'cola_offline'
const enLinea = () => typeof navigator === 'undefined' || navigator.onLine !== false

// La cola va por cuenta, como la caché: en un móvil compartido, lo pendiente de una
// persona nunca se envía con la sesión de otra.
export const colaOffline = crearColaOffline({
  almacen: {
    leer: () => { const l = leerCache(CLAVE); return Array.isArray(l) ? l : [] },
    guardar: (l) => guardarCache(CLAVE, l),
  },
  ejecutar: (op) => (supabase ? ejecutarOperacion(supabase, op) : Promise.resolve({ error: { message: 'Sin Supabase' } })),
  enLinea,
})

/** Hace la acción ya o la deja en cola. 'hecha' | 'encolada' | 'error'. */
export const escribir = (op) => colaOffline.enviar(op)

function suscribirConexion(aviso) {
  window.addEventListener('online', aviso)
  window.addEventListener('offline', aviso)
  return () => {
    window.removeEventListener('online', aviso)
    window.removeEventListener('offline', aviso)
  }
}

/** { enLinea, pendientes }: se actualiza solo al perder o recuperar la red. */
export function useConexion() {
  const conectado = useSyncExternalStore(suscribirConexion, enLinea, () => true)
  const pendientes = useSyncExternalStore(colaOffline.suscribir, colaOffline.cuantas, () => 0)
  return { enLinea: conectado, pendientes }
}
