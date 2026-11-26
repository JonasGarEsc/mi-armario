-- Perletta: actualización a la versión 5 (cuotas, valoraciones y avisos).
-- Pégalo entero en Supabase → SQL Editor después de actualizacion-v4.sql.
-- Es idempotente y va en una sola transacción: o se aplica todo o nada.
--
-- Qué añade:
--   1. Un solo uso por prenda y día.
--   2. Cuota diaria de las funciones de pago (etiquetar-prenda y leer-enlace).
--   3. Valoraciones por usuario (me gusta / no me gusta).
--   4. Suscripciones a avisos push.

begin;

-- 1. Un uso por prenda y día ------------------------------------------------
-- Las copias antiguas podían dejar filas gemelas. Nos quedamos con una (la de
-- menor ctid) antes de crear el índice único.

delete from public.usos u
using public.usos v
where u.prenda_id = v.prenda_id
  and u.fecha = v.fecha
  and u.ctid > v.ctid;

create unique index if not exists usos_prenda_fecha_idx
  on public.usos (prenda_id, fecha);

-- 2. Cuota diaria de las funciones de pago ----------------------------------
-- Sin políticas y sin permisos: solo consumir_cuota (security definer) toca
-- esta tabla. Cada función llama a consumir_cuota antes de gastar dinero.

create table if not exists public.uso_funciones (
  user_id uuid not null references auth.users (id) on delete cascade,
  dia date not null default current_date,
  funcion text not null,
  llamadas int not null default 0,
  primary key (user_id, dia, funcion)
);

alter table public.uso_funciones enable row level security;
revoke all on public.uso_funciones from anon, authenticated;

create or replace function public.consumir_cuota(nombre text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  limite int;
  usuario uuid := auth.uid();
begin
  -- El límite vive aquí, no en la Edge Function.
  limite := case nombre
    when 'etiquetar-prenda' then 100
    when 'leer-enlace' then 50
    else null
  end;

  if usuario is null or limite is null then
    return false;
  end if;

  insert into public.uso_funciones (user_id, dia, funcion, llamadas)
  values (usuario, current_date, nombre, 1)
  on conflict (user_id, dia, funcion) do update
    set llamadas = public.uso_funciones.llamadas + 1
    where public.uso_funciones.llamadas < limite;

  -- found es false cuando el UPDATE no llegó a ejecutarse por el WHERE.
  return found;
end;
$$;

revoke all on function public.consumir_cuota(text) from public, anon;
grant execute on function public.consumir_cuota(text) to authenticated;

-- 3. Valoraciones -----------------------------------------------------------
-- clave: qué se valora (por ejemplo, un outfit). valor: 1 o -1.

create table if not exists public.valoraciones (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  clave text not null check (length(clave) <= 500),
  valor smallint not null check (valor in (-1, 1)),
  creado_en timestamptz not null default now(),
  primary key (user_id, clave)
);

alter table public.valoraciones enable row level security;
drop policy if exists "mi ropa" on public.valoraciones;
create policy "mi ropa" on public.valoraciones for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.valoraciones to authenticated;

-- 4. Avisos push ------------------------------------------------------------

create table if not exists public.avisos_push (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  hora smallint not null default 8 check (hora between 0 and 23),
  zona text not null default 'Europe/Madrid',
  lat real,
  lon real,
  ultimo_envio date
);

alter table public.avisos_push enable row level security;
drop policy if exists "mi ropa" on public.avisos_push;
create policy "mi ropa" on public.avisos_push for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.avisos_push to authenticated;

notify pgrst, 'reload schema';

commit;
