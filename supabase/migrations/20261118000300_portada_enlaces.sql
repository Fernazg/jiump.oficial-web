-- =============================================================================
-- Portada opcional de los «Videos y transmisiones» de cada actividad
-- (actividad_enlaces), elegida desde la biblioteca de fotos. Igual que la
-- portada de los videos de la galería (migración portada_videos).
--
-- · La portada viaja con los enlaces al guardar la actividad (aplicar_actividad).
-- · Cambiarla en una actividad publicada queda en cambios pendientes y exige
--   vista previa: la huella de la actividad ahora incluye la portada de cada enlace.
-- · Una foto pasa a ser pública si es portada de un enlace de una actividad publicada.
-- =============================================================================

alter table public.actividad_enlaces
  add column portada_foto_id uuid references public.fotos (id) on delete set null;
comment on column public.actividad_enlaces.portada_foto_id is 'Portada del video en el sitio. Opcional: sin ella se usa la miniatura de YouTube.';
create index actividad_enlaces_portada_foto_idx on public.actividad_enlaces (portada_foto_id) where portada_foto_id is not null;

-- El visitante lee solo columnas públicas (migración privacidad_visitante).
grant select (portada_foto_id) on public.actividad_enlaces to anon;

-- -----------------------------------------------------------------------------
-- Guardar: los enlaces se insertan con su portada.
-- -----------------------------------------------------------------------------
create or replace function public.aplicar_actividad(p_id uuid, p_datos jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_fotos uuid[];
  v_portada uuid := nullif(p_datos ->> 'portada_foto_id', '')::uuid;
begin
  select coalesce(array_agg((f ->> 'foto_id')::uuid order by o), '{}')
    into v_fotos from jsonb_array_elements(coalesce(p_datos -> 'fotos', '[]')) with ordinality as t(f, o);
  if v_portada is not null and not v_portada = any (v_fotos) then
    v_portada := null;
  end if;

  update public.actividades set
    titulo = p_datos ->> 'titulo',
    slug = p_datos ->> 'slug',
    tipo = p_datos ->> 'tipo',
    anio = (p_datos ->> 'anio')::smallint,
    fecha_inicio = nullif(p_datos ->> 'fecha_inicio', '')::date,
    fecha_precision = coalesce(nullif(p_datos ->> 'fecha_precision', ''), 'dia'),
    fecha_fin = nullif(p_datos ->> 'fecha_fin', '')::date,
    lugar = nullif(p_datos ->> 'lugar', ''),
    zona = nullif(p_datos ->> 'zona', ''),
    introduccion = nullif(p_datos ->> 'introduccion', ''),
    lema = nullif(p_datos ->> 'lema', ''),
    cita_texto = nullif(p_datos ->> 'cita_texto', ''),
    cita_referencia = nullif(p_datos ->> 'cita_referencia', ''),
    abreviatura = nullif(p_datos ->> 'abreviatura', ''),
    portada_foto_id = v_portada
  where id = p_id;
  if not found then
    raise exception 'Actividad no encontrada o sin permiso' using errcode = '42501';
  end if;

  delete from public.actividad_secciones where actividad_id = p_id;
  insert into public.actividad_secciones (actividad_id, titulo, contenido, orden)
  select p_id, s ->> 'titulo', coalesce(s -> 'contenido', '[]'), o
  from jsonb_array_elements(coalesce(p_datos -> 'secciones', '[]')) with ordinality as t(s, o);

  delete from public.actividad_enlaces where actividad_id = p_id;
  insert into public.actividad_enlaces (actividad_id, titulo, url, orden, portada_foto_id)
  select p_id, e ->> 'titulo', e ->> 'url', o, nullif(e ->> 'portada_foto_id', '')::uuid
  from jsonb_array_elements(coalesce(p_datos -> 'enlaces', '[]')) with ordinality as t(e, o);

  -- Quitar una foto de la actividad no la borra de la biblioteca.
  delete from public.actividad_fotos where actividad_id = p_id and not (foto_id = any (v_fotos));
  update public.actividad_fotos set es_portada = false where actividad_id = p_id and es_portada;
  insert into public.actividad_fotos (actividad_id, foto_id, orden, es_portada)
  select p_id, f, o, coalesce(f = v_portada, false) from unnest(v_fotos) with ordinality as t(f, o)
  on conflict (actividad_id, foto_id) do update set orden = excluded.orden, es_portada = excluded.es_portada;
end;
$$;


-- -----------------------------------------------------------------------------
-- Vista previa: la huella de la actividad incluye la portada de cada enlace.
-- -----------------------------------------------------------------------------
create or replace function public.huella_contenido(p_tipo text, p_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select md5('cambios:' || c.datos::text) from public.contenido_cambios c where c.tipo = p_tipo and c.registro_id = p_id),
    md5(coalesce(case p_tipo
    when 'actividad' then (
      select jsonb_build_object(
        'fila', to_jsonb(x) - array['estado', 'creado_en', 'actualizado_en', 'creado_por', 'actualizado_por', 'destacar_inicio', 'orden_inicio', 'es_proximo'],
        'secciones', (select coalesce(jsonb_agg(jsonb_build_array(s.titulo, s.contenido, s.orden) order by s.orden, s.id), '[]') from public.actividad_secciones s where s.actividad_id = x.id),
        'enlaces', (select coalesce(jsonb_agg(jsonb_build_array(e.titulo, e.url, e.orden, e.portada_foto_id) order by e.orden, e.id), '[]') from public.actividad_enlaces e where e.actividad_id = x.id),
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
    when 'pagina' then (
      select jsonb_build_object(
        'seo', jsonb_build_array(p.seo_titulo, p.seo_descripcion),
        'secciones', (select coalesce(jsonb_agg(jsonb_build_array(s.tipo, s.visible, s.contenido) order by s.orden, s.id), '[]') from public.secciones s where s.pagina_id = p.id)
      )::text from public.paginas p where p.id = p_id)
    when 'menu' then (
      select coalesce(jsonb_agg(jsonb_build_array(m.ubicacion, m.etiqueta, m.url, m.visible, m.orden) order by m.ubicacion, m.orden, m.id), '[]')::text
      from public.menu m)
    when 'institucional' then (
      select coalesce(jsonb_agg(jsonb_build_array(i.tipo, i.titulo, i.texto, i.orden, i.estado) order by i.tipo, i.orden, i.id), '[]')::text
      from public.institucional i)
  end, '')));
$$;


-- -----------------------------------------------------------------------------
-- ¿La foto se usa en contenido público? También: portada de un enlace de una actividad publicada.
-- -----------------------------------------------------------------------------
create or replace function public.foto_es_publica(p_foto_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (select 1 from public.articulos a
             where public.articulo_es_visible(a)
               and (a.portada_foto_id = p_foto_id or a.cuerpo @? format('$.** ? (@ == "%s")', p_foto_id)::jsonpath))
    or exists (select 1 from public.actividades x
                where x.estado = 'publicado' and x.portada_foto_id = p_foto_id)
    or exists (select 1 from public.actividad_fotos af
                 join public.actividades x on x.id = af.actividad_id
                where af.foto_id = p_foto_id and x.estado = 'publicado')
    or exists (select 1 from public.actividad_enlaces e
                 join public.actividades x on x.id = e.actividad_id
                where e.portada_foto_id = p_foto_id and x.estado = 'publicado')
    or exists (select 1 from public.actividad_secciones s
                 join public.actividades x on x.id = s.actividad_id
                where x.estado = 'publicado' and s.contenido @? format('$.** ? (@ == "%s")', p_foto_id)::jsonpath)
    or exists (select 1 from public.albumes al
                where al.estado = 'publicado' and al.portada_foto_id = p_foto_id)
    or exists (select 1 from public.album_fotos af
                 join public.albumes al on al.id = af.album_id
                where af.foto_id = p_foto_id and al.estado = 'publicado')
    or exists (select 1 from public.videos v
                where v.estado = 'publicado' and v.portada_foto_id = p_foto_id)
    or exists (select 1 from public.secciones s
                 join public.paginas p on p.id = s.pagina_id
                where s.visible and p.estado = 'publicado'
                  and s.contenido @? format('$.** ? (@ == "%s")', p_foto_id)::jsonpath)
    or exists (select 1 from public.configuracion c
                where c.seo_foto_id = p_foto_id or c.mantenimiento_foto_id = p_foto_id);
$$;


-- -----------------------------------------------------------------------------
-- Dónde se usa cada foto: también como portada de un video de actividad.
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
           '/admin/articulos/' || a.id as enlace,
           public.tiene_algun_rol('superadmin', 'editor') as accesible
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
    select f.id, case when x.portada_foto_id = f.id then 'Portada de actividad'
                      when exists (select 1 from public.actividad_enlaces e where e.actividad_id = x.id and e.portada_foto_id = f.id) then 'Portada de video de actividad'
                      else 'Fotos de actividad' end,
           x.titulo, x.estado = 'publicado', '/admin/eventos/' || x.id,
           public.tiene_algun_rol('superadmin', 'eventos')
    from unnest(p_ids) f(id)
    join public.actividades x on x.portada_foto_id = f.id
      or exists (select 1 from public.actividad_fotos af where af.actividad_id = x.id and af.foto_id = f.id)
      or exists (select 1 from public.actividad_secciones s where s.actividad_id = x.id and s.contenido @? format('$.** ? (@ == "%s")', f.id)::jsonpath)
      or exists (select 1 from public.actividad_enlaces e where e.actividad_id = x.id and e.portada_foto_id = f.id)
    -- Álbumes
    union all
    select f.id, case when al.portada_foto_id = f.id then 'Portada de álbum' else 'Álbum' end,
           al.titulo, al.estado = 'publicado', '/admin/galerias/' || al.id,
           public.tiene_algun_rol('superadmin', 'multimedia')
    from unnest(p_ids) f(id)
    join public.albumes al on al.portada_foto_id = f.id
      or exists (select 1 from public.album_fotos af where af.album_id = al.id and af.foto_id = f.id)
    -- Videos (portada)
    union all
    select f.id, 'Portada de video', v.titulo, v.estado = 'publicado', '/admin/videos/' || v.id,
           public.tiene_algun_rol('superadmin', 'multimedia')
    from unnest(p_ids) f(id)
    join public.videos v on v.portada_foto_id = f.id
    -- Cambios sin publicar de actividades, álbumes y videos ya publicados
    union all
    select f.id, case c.tipo when 'actividad' then 'Actividad (cambios sin publicar)' when 'album' then 'Álbum (cambios sin publicar)' else 'Video (cambios sin publicar)' end,
           coalesce(x.titulo, al.titulo, v.titulo), false,
           case c.tipo when 'actividad' then '/admin/eventos/' when 'album' then '/admin/galerias/' else '/admin/videos/' end || c.registro_id,
           public.puede_editar_contenido(c.tipo)
    from unnest(p_ids) f(id)
    join public.contenido_cambios c on c.tipo in ('actividad', 'album', 'video') and c.datos @? format('$.** ? (@ == "%s")', f.id)::jsonpath
    left join public.actividades x on c.tipo = 'actividad' and x.id = c.registro_id
    left join public.albumes al on c.tipo = 'album' and al.id = c.registro_id
    left join public.videos v on c.tipo = 'video' and v.id = c.registro_id
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
  -- El título se ve si la persona puede entrar a esa sección o si ya está
  -- publicado (es público); el enlace al panel, solo con acceso a la sección.
  select u.foto_id, u.tipo,
         case when u.accesible or u.publicado then u.titulo end,
         u.publicado,
         case when u.accesible then u.enlace end
  from usos u
  where public.es_equipo();
$$;

