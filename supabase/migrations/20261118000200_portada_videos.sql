-- =============================================================================
-- Portada opcional de los videos, elegida desde la biblioteca de fotos.
--
-- En el sitio, cada video se muestra con esa portada (o la miniatura de
-- YouTube si no tiene) y un botón de reproducir; el reproductor de YouTube se
-- carga solo al tocarla.
--
-- Una foto pasa a ser pública si es portada de un video publicado (la misma
-- regla con que RLS muestra el video). Los cambios de un video publicado
-- siguen pasando por cambios pendientes y vista previa: la huella del video
-- ya incluye todas sus columnas.
-- =============================================================================

alter table public.videos
  add column portada_foto_id uuid references public.fotos (id) on delete set null;
comment on column public.videos.portada_foto_id is 'Portada del video en el sitio. Opcional: sin ella se usa la miniatura de YouTube.';
create index videos_portada_foto_idx on public.videos (portada_foto_id) where portada_foto_id is not null;

-- El visitante lee solo columnas públicas (migración privacidad_visitante).
-- La columna nueva también lo es. authenticated y service_role ya tienen la tabla completa.
grant select (portada_foto_id) on public.videos to anon;

-- -----------------------------------------------------------------------------
-- Guardar y publicar: aplicar_video también guarda la portada.
-- -----------------------------------------------------------------------------
create or replace function public.aplicar_video(p_id uuid, p_datos jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.videos set
    url = p_datos ->> 'url',
    titulo = p_datos ->> 'titulo',
    descripcion = nullif(p_datos ->> 'descripcion', ''),
    album_id = nullif(p_datos ->> 'album_id', '')::uuid,
    actividad_id = nullif(p_datos ->> 'actividad_id', '')::uuid,
    portada_foto_id = nullif(p_datos ->> 'portada_foto_id', '')::uuid
  where id = p_id;
  if not found then
    raise exception 'Video no encontrado o sin permiso' using errcode = '42501';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- ¿La foto se usa en contenido público? Ahora también: portada de un video publicado.
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
-- Dónde se usa cada foto (aviso antes de eliminarla): también portadas de video.
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
    select f.id, case when x.portada_foto_id = f.id then 'Portada de actividad' else 'Fotos de actividad' end,
           x.titulo, x.estado = 'publicado', '/admin/eventos/' || x.id,
           public.tiene_algun_rol('superadmin', 'eventos')
    from unnest(p_ids) f(id)
    join public.actividades x on x.portada_foto_id = f.id
      or exists (select 1 from public.actividad_fotos af where af.actividad_id = x.id and af.foto_id = f.id)
      or exists (select 1 from public.actividad_secciones s where s.actividad_id = x.id and s.contenido @? format('$.** ? (@ == "%s")', f.id)::jsonpath)
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

