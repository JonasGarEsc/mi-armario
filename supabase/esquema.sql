-- Perletta: esquema completo para un proyecto de Supabase nuevo.
-- Pégalo entero en Supabase → SQL Editor. Es idempotente.
--
-- Si tu proyecto ya tiene datos, NO ejecutes esto: usa actualizacion-v3.sql.
-- Aquí se crean las tablas desde cero, con las cascadas y los índices que
-- espera la aplicación.

create extension if not exists pgcrypto;

-- 1. Tablas --------------------------------------------------------------

create table if not exists public.tipos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now(),
  unique (user_id, nombre)
);

create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo_id uuid not null references public.tipos (id) on delete restrict,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now(),
  unique (user_id, nombre, tipo_id)
);

create table if not exists public.prendas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  imagen_url text not null,
  categoria_id uuid not null references public.categorias (id) on delete restrict,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now()
);

create table if not exists public.maletas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  destino text,
  fecha_inicio date,
  fecha_fin date,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now(),
  unique (user_id, nombre)
);

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

create table if not exists public.conjuntos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  maleta_id uuid references public.maletas (id) on delete cascade,
  semana_id uuid references public.semanas (id) on delete cascade,
  fecha date,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now(),
  check (maleta_id is not null or semana_id is not null)
);

create table if not exists public.conjunto_prenda (
  conjunto_id uuid not null references public.conjuntos (id) on delete cascade,
  prenda_id uuid not null references public.prendas (id) on delete cascade,
  pos_x real not null default 40,
  pos_y real not null default 20,
  z_index integer not null default 1,
  ranura text,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (conjunto_id, prenda_id)
);

create table if not exists public.usos (
  id uuid primary key default gen_random_uuid(),
  prenda_id uuid not null references public.prendas (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha date not null default current_date,
  creado_en timestamptz not null default now()
);

-- 2. Índices -------------------------------------------------------------

create index if not exists prendas_user_idx on public.prendas (user_id, creado_en desc);
create index if not exists prendas_categoria_idx on public.prendas (categoria_id);
create index if not exists categorias_tipo_idx on public.categorias (tipo_id);
create index if not exists conjuntos_maleta_idx on public.conjuntos (maleta_id);
create index if not exists conjuntos_semana_idx on public.conjuntos (semana_id, fecha);
create index if not exists conjunto_prenda_prenda_idx on public.conjunto_prenda (prenda_id);
create index if not exists usos_prenda_idx on public.usos (prenda_id, fecha desc);

-- Un nombre repetido sí vale en maletas distintas; dentro de la misma maleta
-- (o del mismo día de una semana) no, para que la lista sea legible.
create unique index if not exists conjuntos_por_maleta_nombre
  on public.conjuntos (user_id, maleta_id, nombre) where maleta_id is not null;
create unique index if not exists conjuntos_por_dia_nombre
  on public.conjuntos (user_id, semana_id, fecha, nombre) where semana_id is not null;

-- 3. Seguridad -----------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['tipos', 'categorias', 'prendas', 'maletas', 'semanas', 'conjuntos', 'conjunto_prenda', 'usos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "mi ropa" on public.%I', t);
    execute format(
      'create policy "mi ropa" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;

-- Bucket privado: las fotos se leen con URL firmada, no por URL pública.
insert into storage.buckets (id, name, public)
values ('prendas', 'prendas', false)
on conflict (id) do update set public = false;

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

-- 4. Comprobación --------------------------------------------------------
-- select tablename, policyname from pg_policies where schemaname = 'public' order by tablename;
