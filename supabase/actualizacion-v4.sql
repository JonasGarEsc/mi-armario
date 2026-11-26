-- Perletta: actualización a la versión 4 (etiquetado automático y asistente de estilo).
-- Pégalo entero en Supabase → SQL Editor después de actualizacion-v3.sql.
-- Es idempotente: se puede repetir sin romper nada.
-- La app sigue funcionando si todavía no lo has ejecutado (sin las funciones nuevas).
--
-- Qué añade (se va ampliando fase a fase):
--   Fase 1. Datos de cada prenda: colores, temporada, abrigo, formalidad, largo,
--           estampado, precio, etiquetas automáticas y archivada.

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
