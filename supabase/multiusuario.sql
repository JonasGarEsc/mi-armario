-- Perletta: varias cuentas, cada una con su armario.
-- Pégalo entero en Supabase → SQL Editor. Es idempotente: se puede repetir.
--
-- Qué hace:
--   1. Añade user_id a todas las tablas y asigna lo que ya existe al primer usuario.
--   2. Cambia las políticas: cada uno lee y escribe solo sus filas.
--   3. Prepara el bucket para carpetas por usuario.
--   4. Borra la lista de miembros (ya no hace falta).
--   5. Copia el catálogo de tipos y categorías a cada cuenta nueva.

-- 1. Dueño de lo que ya hay: el usuario más antiguo (tú).
do $$
declare t text; dueno uuid;
begin
  select id into dueno from auth.users order by created_at limit 1;

  foreach t in array array[
    'prendas', 'categorias', 'tipos', 'maletas', 'conjuntos', 'conjunto_prenda',
    'etiquetas', 'prenda_etiqueta'
  ] loop
    if to_regclass('public.' || t) is null then
      continue; -- limpieza.sql ya la borró
    end if;

    execute format('alter table public.%I add column if not exists user_id uuid', t);
    execute format('update public.%I set user_id = $1 where user_id is null', t) using dueno;
    execute format('alter table public.%I alter column user_id set default auth.uid()', t);
    execute format('alter table public.%I alter column user_id set not null', t);

    execute format('alter table public.%I drop constraint if exists %I', t, t || '_user_id_fkey');
    execute format(
      'alter table public.%I add constraint %I foreign key (user_id) references auth.users (id) on delete cascade',
      t, t || '_user_id_fkey'
    );
    execute format('create index if not exists %I on public.%I (user_id)', t || '_user_id_idx', t);
  end loop;
end $$;

-- 2. Los nombres únicos pasan a ser únicos por usuario, no globales.
do $$
declare t text; c record;
begin
  foreach t in array array['tipos', 'categorias', 'maletas', 'conjuntos'] loop
    if to_regclass('public.' || t) is null then continue; end if;

    for c in
      select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      where ns.nspname = 'public' and rel.relname = t and con.contype = 'u'
        and (
          select array_agg(a.attname order by a.attname)
          from pg_attribute a
          where a.attrelid = rel.oid and a.attnum = any (con.conkey)
        ) = array['nombre']::name[]
    loop
      execute format('alter table public.%I drop constraint %I', t, c.conname);
    end loop;

    execute format(
      'create unique index if not exists %I on public.%I (user_id, nombre)',
      t || '_usuario_nombre_key', t
    );
  end loop;
end $$;

-- 3. Políticas: cada fila, solo para su dueño.
do $$
declare t text; p record;
begin
  foreach t in array array[
    'prendas', 'categorias', 'tipos', 'maletas', 'conjuntos', 'conjunto_prenda',
    'etiquetas', 'prenda_etiqueta'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;

    execute format('alter table public.%I enable row level security', t);

    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    execute format(
      'create policy "mi ropa" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;

-- 4. Fuera la lista de miembros: ahora entra cualquiera con cuenta y ve solo lo suyo.
drop table if exists public.miembros;
drop function if exists public.es_miembro();

-- 5. Storage: cada cuenta escribe solo dentro de su carpeta (<uuid>/prenda-...).
--    El bucket sigue público para leer por URL, como hasta ahora.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (policyname ilike '%prenda%' or qual ilike '%prendas%' or with_check ilike '%prendas%')
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

create policy "prendas: subir en mi carpeta"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'prendas' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "prendas: cambiar en mi carpeta"
  on storage.objects for update to authenticated
  using (bucket_id = 'prendas' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'prendas' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "prendas: borrar en mi carpeta"
  on storage.objects for delete to authenticated
  using (bucket_id = 'prendas' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 6. Cada cuenta empieza vacía: sus tipos y categorías los crea ella en Ajustes.
--    (Aquí se retira la herencia que hubiera de una versión anterior.)
drop trigger if exists sembrar_armario on auth.users;
drop function if exists public.sembrar_armario();

-- 7. Comprobación: todas las tablas deben salir con la política "mi ropa".
-- select tablename, policyname from pg_policies where schemaname = 'public' order by tablename;
