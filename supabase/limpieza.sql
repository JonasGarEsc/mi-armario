-- Limpieza de lo que la app no usa.
-- Pégalo en Supabase → SQL Editor. No se puede deshacer:
-- antes, descarga una copia desde el menú de Perletta (avatar → Exportar copia de seguridad).
--
-- Comprueba primero que de verdad están vacías o son prescindibles:
--   select count(*) from etiquetas;
--   select count(*) from prenda_etiqueta;
--   select count(color_principal), count(temporada) from prendas;

alter table prendas drop column if exists color_principal;
alter table prendas drop column if exists temporada;

drop table if exists prenda_etiqueta;
drop table if exists etiquetas;
