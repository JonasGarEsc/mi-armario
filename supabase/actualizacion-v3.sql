-- Perletta: actualización a la versión 3 (semanas, maniquí, usos, clima).
-- Pégalo entero en Supabase → SQL Editor después de multiusuario.sql.
-- Es idempotente: se puede repetir sin romper nada.
--
-- Qué añade:
--   1. Sección «Semana»: tabla semanas y conjuntos.semana_id / fecha.
--   2. Maniquí: columna ranura en conjunto_prenda.
--   3. Registro de uso: tabla usos.
--   4. Clima: destino y fechas del viaje en maletas.
--   5. Nombres repetidos permitidos entre maletas distintas.
--   6. Borrado en cascada de outfits y de sus prendas.
--   7. Bucket privado: las fotos se leen con URL firmada.

-- 1. Semanas -------------------------------------------------------------

create table if not exists public.semanas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now(),
  unique (user_id, fecha_inicio),
  check (fecha_fin >= fecha_inicio)
);

alter table public.semanas enable row level security;
drop policy if exists "mi ropa" on public.semanas;
create policy "mi ropa" on public.semanas for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.conjuntos add column if not exists semana_id uuid;
alter table public.conjuntos add column if not exists fecha date;
alter table public.conjuntos alter column maleta_id drop not null;

-- 2. Maniquí -------------------------------------------------------------

alter table public.conjunto_prenda add column if not exists ranura text;

-- 3. Usos ----------------------------------------------------------------

create table if not exists public.usos (
  id uuid primary key default gen_random_uuid(),
  prenda_id uuid not null references public.prendas (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha date not null default current_date,
  creado_en timestamptz not null default now()
);

alter table public.usos enable row level security;
drop policy if exists "mi ropa" on public.usos;
create policy "mi ropa" on public.usos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Permisos explícitos: si el proyecto no heredó los privilegios por defecto,
-- PostgREST devolvería «permission denied» aunque la tabla exista.
grant select, insert, update, delete on public.semanas to authenticated;
grant select, insert, update, delete on public.usos to authenticated;

-- 4. Clima ---------------------------------------------------------------

alter table public.maletas add column if not exists destino text;
alter table public.maletas add column if not exists fecha_inicio date;
alter table public.maletas add column if not exists fecha_fin date;

-- 5. Nombres -------------------------------------------------------------

-- El índice antiguo impedía llamar «Día 1» a dos outfits de maletas distintas
-- y hacía fallar el segundo clon con el mismo nombre.
drop index if exists public.conjuntos_usuario_nombre_key;

create index if not exists conjuntos_maleta_idx on public.conjuntos (maleta_id);
create index if not exists conjuntos_semana_idx on public.conjuntos (semana_id, fecha);
create index if not exists conjunto_prenda_prenda_idx on public.conjunto_prenda (prenda_id);
create index if not exists usos_prenda_idx on public.usos (prenda_id, fecha desc);
create index if not exists prendas_categoria_idx on public.prendas (categoria_id);
create index if not exists categorias_tipo_idx on public.categorias (tipo_id);

create unique index if not exists conjuntos_por_maleta_nombre
  on public.conjuntos (user_id, maleta_id, nombre) where maleta_id is not null;
create unique index if not exists conjuntos_por_dia_nombre
  on public.conjuntos (user_id, semana_id, fecha, nombre) where semana_id is not null;

-- 6. Cascadas ------------------------------------------------------------

-- Antes de cerrar las claves ajenas, fuera filas huérfanas (no debería haber).
delete from public.conjunto_prenda cp
 where not exists (select 1 from public.conjuntos c where c.id = cp.conjunto_id)
    or not exists (select 1 from public.prendas p where p.id = cp.prenda_id);

do $$
declare r record;
begin
  for r in
    select con.conname, rel.relname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public' and con.contype = 'f'
      and (
        (rel.relname = 'conjunto_prenda' and con.confrelid in ('public.conjuntos'::regclass, 'public.prendas'::regclass))
        or (rel.relname = 'conjuntos' and con.confrelid in ('public.maletas'::regclass, 'public.semanas'::regclass))
        or (rel.relname = 'usos' and con.confrelid = 'public.prendas'::regclass)
      )
  loop
    execute format('alter table public.%I drop constraint %I', r.relname, r.conname);
  end loop;
end $$;

alter table public.conjunto_prenda
  add constraint conjunto_prenda_conjunto_id_fkey
  foreign key (conjunto_id) references public.conjuntos (id) on delete cascade;
alter table public.conjunto_prenda
  add constraint conjunto_prenda_prenda_id_fkey
  foreign key (prenda_id) references public.prendas (id) on delete cascade;
alter table public.conjuntos
  add constraint conjuntos_maleta_id_fkey
  foreign key (maleta_id) references public.maletas (id) on delete cascade;
alter table public.conjuntos
  add constraint conjuntos_semana_id_fkey
  foreign key (semana_id) references public.semanas (id) on delete cascade;
alter table public.usos
  add constraint usos_prenda_id_fkey
  foreign key (prenda_id) references public.prendas (id) on delete cascade;

-- 7. Storage -------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('prendas', 'prendas', false)
on conflict (id) do update set public = false;

-- Fuera las políticas antiguas del bucket (eran de bucket entero).
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

drop policy if exists "prendas: leer las mías" on storage.objects;
create policy "prendas: leer las mías"
  on storage.objects for select to authenticated
  using (bucket_id = 'prendas' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "prendas: subir en mi carpeta" on storage.objects;
create policy "prendas: subir en mi carpeta"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'prendas' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "prendas: cambiar en mi carpeta" on storage.objects;
create policy "prendas: cambiar en mi carpeta"
  on storage.objects for update to authenticated
  using (bucket_id = 'prendas' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'prendas' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "prendas: borrar en mi carpeta" on storage.objects;
create policy "prendas: borrar en mi carpeta"
  on storage.objects for delete to authenticated
  using (bucket_id = 'prendas' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 8. Comprobación --------------------------------------------------------
-- select tablename, policyname from pg_policies where schemaname = 'public' order by tablename;

-- Refresca la caché de PostgREST para que la API vea las tablas nuevas al instante.
notify pgrst, 'reload schema';
