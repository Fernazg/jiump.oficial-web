-- =============================================================================
-- JIUMP · Migración 9: panel /admin etapa 2 (fotos, eventos, galería y videos)
--
--  · fotos.anchos: versiones optimizadas (WebP y AVIF) que generó el panel.
--  · usos_fotos(): dónde se usa cada foto (para avisar antes de eliminarla).
--  · Regla 2 del README: cada foto pertenece a un solo evento. Una foto está
--    en a lo más una actividad y un álbum, y un álbum asociado a una
--    actividad solo tiene fotos de esa actividad.
--  · Vista previa obligatoria antes de publicar actividades, álbumes y videos
--    (como en los artículos, exigida en la base).
--  · marcar_proximo(): «Próximo evento», siempre uno solo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Versiones optimizadas de cada foto
-- Ruta: <carpeta>/<nombre>/<ancho>.webp y .avif (el original no se toca).
-- -----------------------------------------------------------------------------
alter table public.fotos
  add column anchos smallint[] not null default '{}';
alter table public.fotos
  add constraint fotos_anchos_validos check (
    cardinality(anchos) <= 8 and 0 < all (anchos) and 4000 >= all (anchos)
  );
comment on column public.fotos.anchos is 'Anchos (px) de las versiones optimizadas WebP y AVIF. Vacío: solo el original.';

-- -----------------------------------------------------------------------------
-- Regla 2: no mezclar fotos de distintos eventos
-- -----------------------------------------------------------------------------
create unique index album_fotos_una_vez on public.album_fotos (foto_id);
create unique index actividad_fotos_una_vez on public.actividad_fotos (foto_id);

-- Revisa con todos los datos (SECURITY DEFINER): Multimedia no ve actividades
-- en borrador, pero la regla vale igual. El mensaje no revela qué actividad es.
create or replace function public.validar_un_evento_por_foto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conflicto boolean := false;
begin
  if tg_table_name = 'album_fotos' then
    select exists (
      select 1 from public.albumes al
      join public.actividad_fotos xf on xf.foto_id = new.foto_id
      where al.id = new.album_id and xf.actividad_id is distinct from al.actividad_id
    ) into conflicto;
  elsif tg_table_name = 'actividad_fotos' then
    select exists (
      select 1 from public.album_fotos af
      join public.albumes al on al.id = af.album_id
      where af.foto_id = new.foto_id and al.actividad_id is distinct from new.actividad_id
    ) into conflicto;
  elsif tg_table_name = 'albumes' then
    select exists (
      select 1 from public.album_fotos af
      join public.actividad_fotos xf on xf.foto_id = af.foto_id
      where af.album_id = new.id and xf.actividad_id is distinct from new.actividad_id
    ) into conflicto;
  end if;
  if conflicto then
    raise exception 'Esta foto ya pertenece a otro evento: no se mezclan fotos de distintos eventos'
      using errcode = 'P0001', hint = 'foto_de_otro_evento';
  end if;
  return new;
end;
$$;
revoke execute on function public.validar_un_evento_por_foto() from public, anon, authenticated;

create trigger album_fotos_un_evento
  before insert or update on public.album_fotos
  for each row execute function public.validar_un_evento_por_foto();
create trigger actividad_fotos_un_evento
  before insert or update on public.actividad_fotos
  for each row execute function public.validar_un_evento_por_foto();
create trigger albumes_un_evento
  before update of actividad_id on public.albumes
  for each row execute function public.validar_un_evento_por_foto();

-- -----------------------------------------------------------------------------
-- Dónde se usa cada foto
-- SECURITY DEFINER para que el aviso sea completo, pero el título solo se
-- muestra si la persona puede ver ese contenido (si no, «contenido de otra
-- sección»). Solo para el equipo.
-- -----------------------------------------------------------------------------
create or replace function public.usos_fotos(p_ids uuid[])
returns table (foto_id uuid, tipo text, titulo text, publicado boolean, enlace text)
language sql
stable
security definer
set search_path = ''
as $$
  with usos as (
    -- Artículos (portada o imagen del cuerpo) y sus cambios sin publicar
    select f.id as foto_id, 'Artículo'::text as tipo, a.titulo, public.articulo_es_visible(a) as publicado,
           '/admin/articulos/' || a.id as enlace, public.tiene_algun_rol('superadmin', 'editor') as visible
    from unnest(p_ids) f(id)
    join public.articulos a on a.portada_foto_id = f.id or a.cuerpo @? format('$.** ? (@ == "%s")', f.id)::jsonpath
    union all
    select f.id, 'Artículo (cambios sin publicar)', a.titulo, false, '/admin/articulos/' || a.id,
           public.tiene_algun_rol('superadmin', 'editor')
    from unnest(p_ids) f(id)
    join public.articulo_cambios c on c.portada_foto_id = f.id or c.cuerpo @? format('$.** ? (@ == "%s")', f.id)::jsonpath
    join public.articulos a on a.id = c.articulo_id
    -- Actividades
    union all
    select f.id, case when x.portada_foto_id = f.id then 'Portada de actividad' else 'Fotos de actividad' end,
           x.titulo, x.estado = 'publicado', '/admin/eventos/' || x.id,
           public.tiene_algun_rol('superadmin', 'eventos') or x.estado = 'publicado'
    from unnest(p_ids) f(id)
    join public.actividades x on x.portada_foto_id = f.id
      or exists (select 1 from public.actividad_fotos af where af.actividad_id = x.id and af.foto_id = f.id)
      or exists (select 1 from public.actividad_secciones s where s.actividad_id = x.id and s.contenido @? format('$.** ? (@ == "%s")', f.id)::jsonpath)
    -- Álbumes
    union all
    select f.id, case when al.portada_foto_id = f.id then 'Portada de álbum' else 'Álbum' end,
           al.titulo, al.estado = 'publicado', '/admin/galerias/' || al.id,
           public.tiene_algun_rol('superadmin', 'multimedia') or al.estado = 'publicado'
    from unnest(p_ids) f(id)
    join public.albumes al on al.portada_foto_id = f.id
      or exists (select 1 from public.album_fotos af where af.album_id = al.id and af.foto_id = f.id)
    -- Páginas del sitio y configuración
    union all
    select f.id, 'Página «' || p.titulo || '»', s.tipo, p.estado = 'publicado' and s.visible, null,
           public.tiene_rol('superadmin')
    from unnest(p_ids) f(id)
    join public.secciones s on s.contenido @? format('$.** ? (@ == "%s")', f.id)::jsonpath
    join public.paginas p on p.id = s.pagina_id
    union all
    select f.id, 'Configuración del sitio',
           case when c.mantenimiento_foto_id = f.id then 'Foto de mantenimiento' else 'Foto para redes (SEO)' end, true, null,
           public.tiene_rol('superadmin')
    from unnest(p_ids) f(id)
    join public.configuracion c on c.seo_foto_id = f.id or c.mantenimiento_foto_id = f.id
  )
  select u.foto_id, u.tipo,
         case when u.visible then u.titulo end,
         u.publicado,
         case when u.visible then u.enlace end
  from usos u
  where public.es_equipo();
$$;
revoke execute on function public.usos_fotos(uuid[]) from public, anon;
grant execute on function public.usos_fotos(uuid[]) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Vista previa obligatoria: actividades, álbumes y videos
-- La huella resume el contenido que se ve en el sitio (incluye secciones,
-- enlaces y fotos). Se calcula en la base, no en el navegador.
-- -----------------------------------------------------------------------------
create or replace function public.huella_contenido(p_tipo text, p_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select md5(coalesce(case p_tipo
    when 'actividad' then (
      select jsonb_build_object(
        'fila', to_jsonb(x) - array['estado', 'creado_en', 'actualizado_en', 'creado_por', 'actualizado_por', 'destacar_inicio', 'orden_inicio', 'es_proximo'],
        'secciones', (select coalesce(jsonb_agg(jsonb_build_array(s.titulo, s.contenido, s.orden) order by s.orden, s.id), '[]') from public.actividad_secciones s where s.actividad_id = x.id),
        'enlaces', (select coalesce(jsonb_agg(jsonb_build_array(e.titulo, e.url, e.orden) order by e.orden, e.id), '[]') from public.actividad_enlaces e where e.actividad_id = x.id),
        'fotos', (select coalesce(jsonb_agg(jsonb_build_array(f.foto_id, f.orden, f.es_portada) order by f.orden, f.foto_id), '[]') from public.actividad_fotos f where f.actividad_id = x.id)
      )::text from public.actividades x where x.id = p_id)
    when 'album' then (
      select jsonb_build_object(
        'fila', to_jsonb(al) - array['estado', 'creado_en', 'actualizado_en', 'creado_por', 'actualizado_por', 'orden'],
        'fotos', (select coalesce(jsonb_agg(jsonb_build_array(f.foto_id, f.orden) order by f.orden, f.foto_id), '[]') from public.album_fotos f where f.album_id = al.id)
      )::text from public.albumes al where al.id = p_id)
    when 'video' then (
      select (to_jsonb(v) - array['estado', 'creado_en', 'actualizado_en', 'creado_por', 'actualizado_por', 'orden'])::text
      from public.videos v where v.id = p_id)
  end, ''));
$$;
revoke execute on function public.huella_contenido(text, uuid) from public, anon;
grant execute on function public.huella_contenido(text, uuid) to authenticated, service_role;

create or replace function public.puede_editar_contenido(p_tipo text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case p_tipo
    when 'actividad' then public.tiene_algun_rol('superadmin', 'eventos')
    when 'album' then public.tiene_algun_rol('superadmin', 'multimedia')
    when 'video' then public.tiene_algun_rol('superadmin', 'multimedia')
    else false
  end;
$$;
revoke execute on function public.puede_editar_contenido(text) from public, anon;
grant execute on function public.puede_editar_contenido(text) to authenticated, service_role;

create table public.vistas_previas_contenido (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('actividad', 'album', 'video')),
  registro_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  huella text not null,
  visto_en timestamptz not null default now()
);
create index vistas_previas_contenido_idx on public.vistas_previas_contenido (tipo, registro_id, user_id, huella);

alter table public.vistas_previas_contenido enable row level security;
grant select, insert, delete on public.vistas_previas_contenido to authenticated;
revoke all on public.vistas_previas_contenido from anon;

create policy vistas_previas_contenido_leer on public.vistas_previas_contenido
  for select to authenticated
  using (user_id = (select auth.uid()) and public.puede_editar_contenido(tipo));
create policy vistas_previas_contenido_registrar on public.vistas_previas_contenido
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.puede_editar_contenido(tipo)
    and huella = public.huella_contenido(tipo, registro_id)
  );
create policy vistas_previas_contenido_borrar on public.vistas_previas_contenido
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Publicar exige la vista previa del contenido tal como está guardado. El
-- cambio a «publicado» no puede modificar a la vez el contenido.
create or replace function public.exigir_vista_previa_contenido()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tipo text := case tg_table_name when 'actividades' then 'actividad' when 'albumes' then 'album' else 'video' end;
  v_meta text[] := array['estado', 'creado_en', 'actualizado_en', 'creado_por', 'actualizado_por', 'destacar_inicio', 'orden_inicio', 'es_proximo', 'orden'];
begin
  if current_user <> 'authenticated' or new.estado <> 'publicado' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.estado = 'publicado' then
    return new;
  end if;
  if tg_op = 'INSERT' or (to_jsonb(new) - v_meta) is distinct from (to_jsonb(old) - v_meta) or not exists (
    select 1 from public.vistas_previas_contenido v
    where v.tipo = v_tipo and v.registro_id = new.id and v.user_id = auth.uid()
      and v.huella = public.huella_contenido(v_tipo, new.id)
  ) then
    raise exception 'Antes de publicar hay que revisar la vista previa de este contenido'
      using errcode = 'P0001', hint = 'vista_previa_pendiente';
  end if;
  return new;
end;
$$;
revoke execute on function public.exigir_vista_previa_contenido() from public, anon, authenticated;

create trigger actividades_exigir_vista_previa
  before insert or update on public.actividades
  for each row execute function public.exigir_vista_previa_contenido();
create trigger albumes_exigir_vista_previa
  before insert or update on public.albumes
  for each row execute function public.exigir_vista_previa_contenido();
create trigger videos_exigir_vista_previa
  before insert or update on public.videos
  for each row execute function public.exigir_vista_previa_contenido();

-- -----------------------------------------------------------------------------
-- «Próximo evento»: solo una actividad a la vez (respeta RLS)
-- -----------------------------------------------------------------------------
create or replace function public.marcar_proximo(p_actividad_id uuid, p_valor boolean)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_valor then
    update public.actividades set es_proximo = false where es_proximo and id <> p_actividad_id;
  end if;
  update public.actividades set es_proximo = p_valor where id = p_actividad_id;
  if not found then
    raise exception 'Actividad no encontrada o sin permiso' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.marcar_proximo(uuid, boolean) from public, anon;
grant execute on function public.marcar_proximo(uuid, boolean) to authenticated, service_role;
