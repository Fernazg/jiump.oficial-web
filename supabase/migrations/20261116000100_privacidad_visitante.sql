-- =============================================================================
-- JIUMP · Migración 12: lo que ve el visitante, columna por columna
-- Revisión profesional (docs/revision-profesional.md). Pruebas en
-- supabase/tests/database/privacidad.test.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- P1 · El visitante podía leer columnas internas
-- RLS ya limitaba las FILAS a lo publicado, pero con la clave anónima (que es
-- pública) se podían pedir TODAS las columnas: qué cuenta del equipo creó y
-- editó cada contenido (creado_por, actualizado_por) y el paso de un artículo
-- por la papelera. Ahora el visitante solo tiene permiso sobre las columnas
-- que el sitio muestra. El equipo (con sesión) no cambia.
--
-- Importante para el futuro: una columna NUEVA nace cerrada para el visitante.
-- Si el sitio público debe mostrarla, hay que darle permiso en su migración:
--   grant select (columna) on public.tabla to anon;
-- -----------------------------------------------------------------------------
do $$
declare
  t record;
  columnas text;
begin
  for t in
    select c.oid, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and has_table_privilege('anon', c.oid, 'select')
  loop
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into columnas
    from pg_attribute a
    where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
      and a.attname not in ('creado_por', 'actualizado_por', 'estado_antes_papelera', 'en_papelera_desde');
    execute format('revoke all on public.%I from anon', t.relname);
    execute format('grant select (%s) on public.%I to anon', columnas, t.relname);
  end loop;
end $$;

-- La búsqueda devolvía la fila completa del artículo (a.*). Ahora devuelve
-- solo las columnas que usan el sitio y el panel.
drop function public.buscar_articulos(text);
create function public.buscar_articulos(q text)
returns table (
  id uuid, titulo text, slug text, bajada text, autor text, serie_id uuid, parte smallint,
  portada_foto_id uuid, cuerpo jsonb, estado public.estado_articulo, publicado_en timestamptz, minutos_lectura smallint
)
language sql
stable
set search_path = ''
as $$
  select a.id, a.titulo, a.slug, a.bajada, a.autor, a.serie_id, a.parte,
         a.portada_foto_id, a.cuerpo, a.estado, a.publicado_en, a.minutos_lectura
  from public.articulos a
  where a.busqueda @@ websearch_to_tsquery('spanish', public.sin_tildes(q))
    and a.estado <> 'papelera'
  order by ts_rank(a.busqueda, websearch_to_tsquery('spanish', public.sin_tildes(q))) desc,
           a.publicado_en desc nulls last
  limit 50;
$$;
revoke execute on function public.buscar_articulos(text) from public;
grant execute on function public.buscar_articulos(text) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- P2 · Redirecciones: un destino «//otro-sitio» parecía una ruta interna
-- El navegador lo interpreta como otro dominio. Solo un Superadministrador
-- puede crear redirecciones, pero la base ahora lo rechaza igual: un destino
-- interno empieza con una sola «/»; uno externo, con «https://».
-- -----------------------------------------------------------------------------
alter table public.redirecciones
  add constraint redirecciones_destino_claro check (destino !~ '^/[/\\]');
