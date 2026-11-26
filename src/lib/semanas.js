// Semanas del calendario: en cuál cae un día y cómo se llama una nueva.

import { etiquetaRango, finDeSemana, isoLocal, lunesDe } from './fechas.js'

/** La semana (de las que ya existen) que contiene ese día, o null. */
export function semanaParaFecha(semanas, fechaISO) {
  return (semanas || []).find((s) => s.fecha_inicio <= fechaISO && fechaISO <= s.fecha_fin) || null
}

/** Datos de la semana de lunes a domingo que contiene ese día. */
export function semanaNuevaPara(fechaISO) {
  const desde = isoLocal(lunesDe(fechaISO))
  const hasta = isoLocal(finDeSemana(fechaISO))
  return { nombre: etiquetaRango(desde, hasta), fecha_inicio: desde, fecha_fin: hasta }
}
