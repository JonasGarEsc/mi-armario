/** Columnas de la cuadrícula de la imagen resumen según cuántos outfits hay. */
export const columnasDeResumen = (n) => (n <= 4 ? 2 : n <= 9 ? 3 : 4)
