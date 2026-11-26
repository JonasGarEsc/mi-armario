/**
 * La URL que se enseña: la firmada nueva y, si no hay (sin conexión), la última firmada
 * que se guardó, aunque haya caducado: el Service Worker guarda la foto por su ruta
 * y no por el token, así que esa URL vieja sigue encontrando la foto en la caché.
 */
export const elegirUrl = (firmada, vieja, canonica) => firmada || vieja || canonica || null
