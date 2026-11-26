// Nombres que no chocan con los que ya hay.
// «Copia» → «Copia (2)» → «Copia (3)».

export function nombreLibre(base, existentes = []) {
  const limpio = String(base || '').trim()
  const ocupados = new Set(existentes.map((n) => String(n || '').trim().toLowerCase()))
  if (!ocupados.has(limpio.toLowerCase())) return limpio
  const raiz = limpio.replace(/\s*\((\d+)\)\s*$/, '')
  let n = 2
  while (ocupados.has(`${raiz} (${n})`.toLowerCase())) n++
  return `${raiz} (${n})`
}
