// Piezas comunes de las propuestas de outfit: verla en el maniquí y guardarla
// como outfit de hoy. Las usan «Hoy» y «¿Qué me pongo?».

import { isoLocal } from './fechas.js'
import { esDuplicado } from './outfits.js'
import { RANURAS } from './maniqui.js'
import { nombreLibre } from './nombres.js'
import { semanaNuevaPara, semanaParaFecha } from './semanas.js'
import { huecoDe } from './sugerir.js'
import { insertarUsos } from './uso.js'

const CONSULTA_DEL_DIA = 'id, nombre, fecha, conjunto_prenda(*, prendas(*, categorias(nombre, tipos(nombre))))'
const CONSULTA_SIN_RANURA = 'id, nombre, fecha, conjunto_prenda(conjunto_id, prenda_id, pos_x, pos_y, z_index, prendas(*, categorias(nombre, tipos(nombre))))'

/** Outfit propuesto → el formato que entiende el lienzo del maniquí. */
export function comoConjunto(outfit) {
  const piezas = Object.values(outfit.piezas).filter(Boolean)
  return {
    id: `sug-${outfit.clave}`,
    conjunto_prenda: piezas.map((p) => {
      const ranura = huecoDe(p)
      return { conjunto_id: 'sug', prenda_id: p.id, ranura, z_index: RANURAS[ranura].capa, pos_x: 0, pos_y: 0, prendas: p }
    }),
  }
}

/** Outfit planificado para ese día en la semana (el primero con prendas), o null. */
export async function outfitDelDia(supabase, fecha) {
  if (!supabase) return null
  const buscar = (columnas) => supabase
    .from('conjuntos')
    .select(columnas)
    .eq('fecha', fecha)
    .not('semana_id', 'is', null)
  let { data, error } = await buscar(CONSULTA_DEL_DIA)
  // Base antigua sin alguna columna del lienzo: se lee igual, con menos detalle.
  if (error) ({ data } = await buscar(CONSULTA_SIN_RANURA))
  return (data || []).find((c) => (c.conjunto_prenda || []).some((cp) => cp.prendas)) || null
}

/** «Me lo pongo»: deja el outfit como el de hoy en la semana y anota cada uso. */
export async function guardarOutfitDeHoy(supabase, outfit, hoy = isoLocal(new Date())) {
  const { data: semanas } = await supabase.from('semanas').select('id, fecha_inicio, fecha_fin')
  let semana = semanaParaFecha(semanas, hoy)
  if (!semana) {
    const { data, error } = await supabase.from('semanas').insert([semanaNuevaPara(hoy)]).select('id, fecha_inicio, fecha_fin').single()
    if (error) throw new Error('No se pudo crear la semana')
    semana = data
  }

  const { data: delDia } = await supabase
    .from('conjuntos').select('id, nombre, conjunto_prenda(prenda_id)').eq('semana_id', semana.id).eq('fecha', hoy)
  const yaEsta = esDuplicado(delDia, outfit.ids)

  if (!yaEsta) {
    const conjunto = {
      nombre: nombreLibre('Outfit de hoy', (delDia || []).map((c) => c.nombre)),
      semana_id: semana.id,
      fecha: hoy,
    }
    const piezas = Object.values(outfit.piezas).filter(Boolean)
    const conRanura = piezas.map((p) => ({ prenda_id: p.id, ranura: huecoDe(p), z_index: RANURAS[huecoDe(p)].capa }))
    let { error } = await supabase.from('conjuntos').insert([{ ...conjunto, conjunto_prenda: conRanura }])
    // Base de datos sin la columna ranura: se guarda igual, sin imantación.
    if (error) ({ error } = await supabase.from('conjuntos').insert([{ ...conjunto, conjunto_prenda: piezas.map((p) => ({ prenda_id: p.id })) }]))
    if (error) throw new Error('No se pudo guardar el outfit')
  }

  const usos = Object.values(outfit.piezas).filter(Boolean)
    .filter((p) => !(p.usos || []).some((u) => u.fecha === hoy))
    .map((p) => ({ prenda_id: p.id, fecha: hoy }))
  // Un duplicado cuenta como éxito; cualquier otro fallo se avisa.
  if (usos.length) {
    const errorUsos = await insertarUsos(supabase, usos)
    if (errorUsos) throw new Error('No se pudo anotar el uso de las prendas')
  }

  return { yaEsta, semana }
}
