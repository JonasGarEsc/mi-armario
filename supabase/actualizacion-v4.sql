-- Perletta: actualización a la versión 4 (etiquetado automático y asistente de estilo).
-- Pégalo entero en Supabase → SQL Editor después de actualizacion-v3.sql.
-- Es idempotente: se puede repetir sin romper nada.
-- La app sigue funcionando si todavía no lo has ejecutado (sin las funciones nuevas).
--
-- Qué añade (se va ampliando fase a fase):
--   Fase 1. Datos de cada prenda: colores, temporada, abrigo, formalidad, largo,
--           estampado, precio, etiquetas automáticas y archivada.
--   Fase 3. Lista de la maleta en la base de datos (tabla maleta_extras).
--   Fase 4. Marcar prendas para donar o vender (columna salida).
--   Fase 5. Escala y «por dentro» de cada prenda en el maniquí.

-- Fase 1 · Etiquetas de las prendas ----------------------------------------

alter table public.prendas add column if not exists colores text[];
alter table public.prendas add column if not exists familia_color text;
alter table public.prendas add column if not exists temporada text[];
alter table public.prendas add column if not exists abrigo smallint;
alter table public.prendas add column if not exists formalidad smallint;
alter table public.prendas add column if not exists largo text;
alter table public.prendas add column if not exists estampado text;
alter table public.prendas add column if not exists precio numeric(10, 2);
-- null = aún sin etiquetar · true = las puso la IA · false = las editaste a mano
alter table public.prendas add column if not exists etiquetas_auto boolean;
alter table public.prendas add column if not exists archivada boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prendas_abrigo_rango') then
    alter table public.prendas add constraint prendas_abrigo_rango check (abrigo is null or abrigo between 1 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prendas_formalidad_rango') then
    alter table public.prendas add constraint prendas_formalidad_rango check (formalidad is null or formalidad between 1 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prendas_precio_positivo') then
    alter table public.prendas add constraint prendas_precio_positivo check (precio is null or precio >= 0);
  end if;
end $$;

create index if not exists prendas_etiquetas_idx on public.prendas (user_id, etiquetas_auto);

-- Fase 3 · Lista de la maleta ------------------------------------------------
-- Antes la lista (casillas de prendas) vivía solo en el móvil. Ahora cada fila es
-- una cosa que no es ropa (texto) o una prenda ya metida en la maleta (prenda_id).

create table if not exists public.maleta_extras (
  id uuid primary key default gen_random_uuid(),
  maleta_id uuid not null references public.maletas (id) on delete cascade,
  texto text,
  prenda_id uuid references public.prendas (id) on delete cascade,
  hecho boolean not null default false,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now(),
  check (texto is not null or prenda_id is not null),
  unique (maleta_id, prenda_id)
);

create unique index if not exists maleta_extras_texto_idx
  on public.maleta_extras (maleta_id, lower(texto)) where texto is not null;
create index if not exists maleta_extras_maleta_idx on public.maleta_extras (maleta_id);

alter table public.maleta_extras enable row level security;
drop policy if exists "mi ropa" on public.maleta_extras;
create policy "mi ropa" on public.maleta_extras for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.maleta_extras to authenticated;

-- Fase 4 · Lo que ya no te pones ---------------------------------------------
-- salida: 'donar' o 'vender' marca una prenda para sacarla del armario; no se propone
-- en «¿Qué me pongo hoy?» ni en las maletas. archivada (Fase 1) la oculta del todo.

alter table public.prendas add column if not exists salida text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prendas_salida_valida') then
    alter table public.prendas add constraint prendas_salida_valida check (salida is null or salida in ('donar', 'vender'));
  end if;
end $$;

-- Fase 5 · Pulido del maniquí --------------------------------------------------
-- escala: pellizcar una prenda del maniquí la agranda o encoge hasta un 20 %.
-- por_dentro: la camiseta metida por dentro del pantalón.

alter table public.conjunto_prenda add column if not exists escala real not null default 1;
alter table public.conjunto_prenda add column if not exists por_dentro boolean not null default false;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'conjunto_prenda_escala_rango') then
    alter table public.conjunto_prenda add constraint conjunto_prenda_escala_rango check (escala between 0.5 and 1.5);
  end if;
end $$;
