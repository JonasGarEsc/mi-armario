// Fechas locales, sin sustos de zona horaria.

export const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
export const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Date → «AAAA-MM-DD» en hora local. */
export function isoLocal(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

/** «AAAA-MM-DD» o Date → Date a medianoche local. */
export function desdeISO(valor) {
  if (valor instanceof Date) return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate())
  const [y, m, d] = String(valor || '').split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1)
}

/** Lunes de la semana de esa fecha. */
export function lunesDe(fecha) {
  const d = desdeISO(fecha)
  const desplazamiento = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - desplazamiento)
  return d
}

/** Domingo de la semana de esa fecha. */
export function finDeSemana(fecha) {
  const d = lunesDe(fecha)
  d.setDate(d.getDate() + 6)
  return d
}

/** Los siete días (lunes a domingo) de la semana de esa fecha. */
export function diasDeSemana(fecha) {
  const inicio = lunesDe(fecha)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio)
    d.setDate(d.getDate() + i)
    return d
  })
}

/** «30 nov – 6 dic» o «30 dic 2026 – 5 ene 2027». */
export function etiquetaRango(inicio, fin) {
  const ini = desdeISO(inicio)
  const f = desdeISO(fin)
  const mismoAnio = ini.getFullYear() === f.getFullYear()
  const mismoMes = mismoAnio && ini.getMonth() === f.getMonth()
  if (mismoMes) return `${ini.getDate()}–${f.getDate()} ${MESES_CORTOS[ini.getMonth()]}`
  if (mismoAnio) {
    return `${ini.getDate()} ${MESES_CORTOS[ini.getMonth()]} – ${f.getDate()} ${MESES_CORTOS[f.getMonth()]}`
  }
  return `${ini.getDate()} ${MESES_CORTOS[ini.getMonth()]} ${ini.getFullYear()} – ${f.getDate()} ${MESES_CORTOS[f.getMonth()]} ${f.getFullYear()}`
}

/** «lun 30» para un día suelto. */
export function etiquetaDia(fecha) {
  const d = desdeISO(fecha)
  return `${DIAS[(d.getDay() + 6) % 7]} ${d.getDate()}`
}

/** «12 nov» para la última vez que te pusiste algo. */
export function etiquetaFechaCorta(fecha) {
  const d = desdeISO(fecha)
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`
}

export function mismoDia(a, b) {
  if (!a || !b) return false
  const x = desdeISO(a)
  const y = desdeISO(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}

/** Celdas del mes, con huecos al principio y al final, para una rejilla de 7. */
export function celdasMes(anio, mes) {
  const primero = new Date(anio, mes, 1)
  const desplazamiento = (primero.getDay() + 6) % 7
  const dias = new Date(anio, mes + 1, 0).getDate()
  const celdas = Array.from({ length: desplazamiento }, () => null)
  for (let d = 1; d <= dias; d++) celdas.push(new Date(anio, mes, d))
  while (celdas.length % 7 !== 0) celdas.push(null)
  return celdas
}
