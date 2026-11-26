// PostgREST no admite inserciones anidadas: primero se crean los outfits con un
// id generado en cliente y después sus prendas con conjunto_id.

/**
 * Inserta uno o varios conjuntos con sus prendas (`conjunto_prenda`).
 * Si falla el segundo paso, borra los conjuntos recién creados para no dejarlos vacíos.
 * Devuelve el error o null.
 */
export async function insertarConjuntos(supabase, filas) {
  if (!filas || filas.length === 0) return null

  const conjuntos = []
  const prendas = []

  for (const { conjunto_prenda: piezas = [], ...conjunto } of filas) {
    const id = conjunto.id || crypto.randomUUID()
    conjuntos.push({ ...conjunto, id })
    for (const pieza of piezas || []) {
      prendas.push({ ...pieza, conjunto_id: id })
    }
  }

  const { error: errorConjuntos } = await supabase.from('conjuntos').insert(conjuntos)
  if (errorConjuntos) return errorConjuntos
  if (prendas.length === 0) return null

  // defaultToNull: false evita enviar null en columnas NOT NULL con valor por defecto
  // cuando las prendas del lote no traen exactamente las mismas claves.
  const { error: errorPrendas } = await supabase
    .from('conjunto_prenda')
    .insert(prendas, { defaultToNull: false })
  if (errorPrendas) {
    await supabase.from('conjuntos').delete().in('id', conjuntos.map((c) => c.id))
    return errorPrendas
  }

  return null
}
