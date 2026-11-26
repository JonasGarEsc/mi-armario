import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8')
const sinComentarios = (sql) => sql.replace(/--[^\n]*/g, '')

const v5 = sinComentarios(leer('supabase/actualizacion-v5.sql'))
const esquema = sinComentarios(leer('supabase/esquema.sql'))
const etiquetar = leer('supabase/functions/etiquetar-prenda/index.ts')
const leerEnlace = leer('supabase/functions/leer-enlace/index.ts')

test('la actualización v5 va en una transacción y deja un uso por prenda y día', () => {
  assert.match(v5, /\bbegin\s*;/i)
  assert.match(v5, /\bcommit\s*;/i)
  assert.match(v5, /delete\s+from\s+public\.usos/i)
  assert.match(v5, /create\s+unique\s+index\s+if\s+not\s+exists\s+usos_prenda_fecha_idx\s+on\s+public\.usos\s*\(\s*prenda_id\s*,\s*fecha\s*\)/i)
  assert.match(esquema, /create\s+unique\s+index\s+if\s+not\s+exists\s+usos_prenda_fecha_idx\s+on\s+public\.usos\s*\(\s*prenda_id\s*,\s*fecha\s*\)/i)
})

test('la cuota diaria es atómica, cerrada por defecto y vive en la base de datos', () => {
  for (const sql of [v5, esquema]) {
    assert.match(sql, /create\s+table\s+if\s+not\s+exists\s+public\.uso_funciones/i)
    assert.match(sql, /primary\s+key\s*\(\s*user_id\s*,\s*dia\s*,\s*funcion\s*\)/i)
    assert.match(sql, /alter\s+table\s+public\.uso_funciones\s+enable\s+row\s+level\s+security/i)
    assert.match(sql, /revoke\s+all\s+on\s+public\.uso_funciones\s+from\s+anon\s*,\s*authenticated/i)
    assert.doesNotMatch(sql, /create\s+policy[^;]*on\s+public\.uso_funciones/i)
    assert.match(sql, /security\s+definer/i)
    assert.match(sql, /set\s+search_path\s*=\s*''/i)
    assert.match(sql, /auth\.uid\(\)/i)
    assert.match(sql, /on\s+conflict\s*\(\s*user_id\s*,\s*dia\s*,\s*funcion\s*\)\s*do\s+update[\s\S]*?where\s+public\.uso_funciones\.llamadas\s*<\s*limite/i)
    assert.match(sql, /when\s+'etiquetar-prenda'\s+then\s+100/i)
    assert.match(sql, /when\s+'leer-enlace'\s+then\s+50/i)
    assert.match(sql, /grant\s+execute\s+on\s+function\s+public\.consumir_cuota\(text\)\s+to\s+authenticated/i)
  }
})

test('valoraciones y avisos push tienen dueño, límites y política «mi ropa»', () => {
  for (const tabla of ['valoraciones', 'avisos_push']) {
    assert.match(v5, new RegExp(`create table if not exists public\\.${tabla}`, 'i'))
    assert.match(v5, new RegExp(`create policy "mi ropa" on public\\.${tabla}`, 'i'))
    assert.match(v5, new RegExp(`grant select, insert, update, delete on public\\.${tabla} to authenticated`, 'i'))
    assert.match(esquema, new RegExp(`create table if not exists public\\.${tabla}`, 'i'))
  }
  assert.match(v5, /clave text[^,]*check\s*\(\s*length\(clave\)\s*<=\s*500\s*\)/i)
  assert.match(v5, /valor smallint[^,]*check\s*\(\s*valor in \(-1,\s*1\)\s*\)/i)
  assert.match(v5, /hora smallint[^,]*check\s*\(\s*hora between 0 and 23\s*\)/i)
})

test('las edge functions cobran cuota antes de la llamada cara y fallan cerrado', () => {
  const rpcEtiqueta = etiquetar.indexOf("rpc('consumir_cuota'")
  const anthropic = etiquetar.indexOf("fetch('https://api.anthropic.com")
  assert.ok(rpcEtiqueta > 0 && anthropic > rpcEtiqueta)
  assert.match(etiquetar, /nombre:\s*'etiquetar-prenda'/)
  assert.match(etiquetar, /errorCuota \|\| cuota !== true/)
  assert.match(etiquetar, /429/)
  assert.match(etiquetar, /AbortSignal\.timeout\(/)

  const rpcEnlace = leerEnlace.indexOf("rpc('consumir_cuota'")
  const descarga = leerEnlace.indexOf('const inicio = Date.now()')
  assert.ok(rpcEnlace > 0 && descarga > rpcEnlace)
  assert.match(leerEnlace, /nombre:\s*'leer-enlace'/)
  assert.match(leerEnlace, /errorCuota \|\| cuota !== true/)
  assert.match(leerEnlace, /429/)
})
