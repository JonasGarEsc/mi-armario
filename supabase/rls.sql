-- Perletta: cierra la base de datos y el bucket de fotos.
-- Pégalo en Supabase → SQL Editor. Es idempotente: se puede repetir sin romper nada.
--
-- ORDEN (importante):
--   1. Crea tu usuario en Authentication → Users → Add user (con «Auto Confirm»).
--   2. Ejecuta este archivo.
--   3. Comprueba que tu fila está en public.miembros (la crea el paso de abajo).
--
-- A partir de aquí, sin sesión iniciada no se lee ni se escribe nada: la clave
-- pública del build deja de servir para tocar datos. Las fotos siguen siendo
-- legibles por URL (el bucket es público y los nombres son aleatorios), pero
-- subir, cambiar o borrar exige sesión.

-- 1. Fuera las políticas abiertas que hubiera (las de `public`, sin rol).
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'prendas', 'categorias', 'tipos', 'maletas', 'conjuntos', 'conjunto_prenda',
        'etiquetas', 'prenda_etiqueta'
      )
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- 2. Lista de miembros. Solo el panel (service role) escribe aquí: no hay
--    política de insert, así que ni con la clave pública se puede añadir gente.
create table if not exists public.miembros (
  user_id uuid primary key references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now()
);

alter table public.miembros enable row level security;

drop policy if exists "miembros: cada uno ve su fila" on public.miembros;
create policy "miembros: cada uno ve su fila"
  on public.miembros for select to authenticated
  using (user_id = auth.uid());

-- security definer para poder leer miembros aunque RLS esté activo.
create or replace function public.es_miembro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.miembros where user_id = auth.uid())
$$;

-- 3. RLS en todas las tablas de la app: solo con sesión, y solo si eres miembro.
do $$
declare t text;
begin
  foreach t in array array[
    'prendas', 'categorias', 'tipos', 'maletas', 'conjuntos', 'conjunto_prenda',
    'etiquetas', 'prenda_etiqueta'
  ] loop
    if to_regclass('public.' || t) is null then
      continue; -- ya la borró limpieza.sql
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "solo miembros" on public.%I for all to authenticated using (public.es_miembro()) with check (public.es_miembro())',
      t
    );
  end loop;
end $$;

-- 4. Tu usuario dentro de la lista. Si ya hay más de uno, el primero es el dueño;
--    si el orden no te cuadra, borra esta línea y añade la tuya a mano:
--    insert into public.miembros (user_id)
--      select id from auth.users where email = 'tu-correo';
insert into public.miembros (user_id)
select id from auth.users order by created_at limit 1
on conflict do nothing;

-- 5. Storage: escribir exige sesión. Las fotos se siguen leyendo por su URL
--    pública (el bucket es público y los nombres son aleatorios), pero ya no se
--    puede listar el bucket ni subir, cambiar o borrar sin sesión.
do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (policyname ilike '%prenda%' or qual ilike '%prendas%' or with_check ilike '%prendas%')
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

drop policy if exists "prendas: lectura" on storage.objects;

drop policy if exists "prendas: subir" on storage.objects;
create policy "prendas: subir"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'prendas');

drop policy if exists "prendas: cambiar" on storage.objects;
create policy "prendas: cambiar"
  on storage.objects for update to authenticated
  using (bucket_id = 'prendas') with check (bucket_id = 'prendas');

drop policy if exists "prendas: borrar" on storage.objects;
create policy "prendas: borrar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'prendas');

-- 6. Comprobación rápida (opcional): deben salir 8 filas, todas con "solo miembros".
-- select tablename, policyname, roles from pg_policies
--  where schemaname = 'public'
--  order by tablename;
