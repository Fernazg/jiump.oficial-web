-- =============================================================================
-- Versión del contenido público, para guardar las páginas ya armadas
-- (Cloudflare Workers, plan gratuito: 10 ms de procesador por visita).
--
-- El Worker guarda cada página pública ya armada junto con la versión con que
-- se armó. En cada visita pregunta a la base `estado_sitio()`: si la versión
-- no cambió, entrega la página guardada sin armarla; si cambió, la arma de
-- nuevo. Así publicar, editar o retirar se nota al instante, como antes.
--
-- La versión sube sola (triggers) con cualquier cambio en el contenido que
-- el sitio público puede mostrar. No depende de que el panel se acuerde.
-- =============================================================================

create table public.version_sitio (
  id smallint primary key default 1 check (id = 1),
  valor bigint not null default 0
);
comment on table public.version_sitio is
  'Contador que sube con cada cambio del contenido público. Lo usa el Worker para saber si una página guardada sigue vigente.';
insert into public.version_sitio (id, valor) values (1, 0);

-- Nadie lee ni escribe la tabla directamente: solo los triggers y estado_sitio().
alter table public.version_sitio enable row level security;
revoke all on public.version_sitio from anon, authenticated;

create function public.subir_version_sitio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.version_sitio set valor = valor + 1 where id = 1;
  return null;
end;
$$;
revoke all on function public.subir_version_sitio() from public, anon, authenticated;

-- Una vez por sentencia (no por fila): importar 100 fotos sube la versión una vez.
do $$
declare
  t text;
begin
  foreach t in array array[
    'fotos', 'series', 'temas', 'articulos', 'articulo_temas',
    'actividades', 'actividad_secciones', 'actividad_enlaces', 'actividad_fotos',
    'albumes', 'album_fotos', 'videos',
    'paginas', 'secciones', 'institucional', 'menu', 'configuracion', 'redirecciones'
  ] loop
    execute format(
      'create trigger %1$s_version_sitio after insert or update or delete or truncate on public.%1$I
         for each statement execute function public.subir_version_sitio()', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- estado_sitio(rutas): lo único que el Worker consulta en cada visita pública.
--   · mantenimiento: si el sitio está en mantenimiento.
--   · redireccion:   si alguna de las rutas tiene una redirección.
--   · version:       versión del contenido. Incluye cuántos artículos
--                    programados ya llegaron a su hora: un artículo programado
--                    aparece solo, sin que nadie edite nada, y eso también
--                    tiene que renovar las páginas guardadas.
-- No revela nada que el sitio público no muestre ya.
-- -----------------------------------------------------------------------------
create function public.estado_sitio(p_rutas text[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'mantenimiento', coalesce((select c.modo_mantenimiento from public.configuracion c limit 1), false),
    'redireccion', exists (select 1 from public.redirecciones r where r.origen = any (p_rutas[1:5])),
    'version', concat_ws('.',
      (select v.valor from public.version_sitio v where v.id = 1),
      (select count(*) from public.articulos a where a.estado = 'programado' and a.publicar_en <= now()))
  );
$$;
revoke all on function public.estado_sitio(text[]) from public;
grant execute on function public.estado_sitio(text[]) to anon, authenticated;
