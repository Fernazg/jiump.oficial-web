-- =============================================================================
-- JIUMP · Migración 3: Row Level Security según docs/roles-permisos.md
--
-- | Sección                               | super | editor | eventos | multimedia |
-- |---------------------------------------|:-----:|:------:|:-------:|:----------:|
-- | Artículos, series y temas             |   ●   |   ●    |    —    |     —      |
-- | Eventos y actividades                 |   ●   |   —    |    ●    |     —      |
-- | Biblioteca de fotos                   |   ●   |   ◐    |    ◐    |     ●      |
-- | Galerías, álbumes y videos            |   ●   |   —    |    —    |     ●      |
-- | Página web, institucional, menú       |   ●   |   —    |    —    |     —      |
-- | Usuarios, roles, registro, config.    |   ●   |   —    |    —    |     —      |
-- ◐ = puede subir y usar fotos; solo edita/borra las propias.
--
-- Visitantes (anon): solo lectura de lo publicado.
-- Multimedia además puede leer actividades (para vincular álbumes, videos y
-- fotos) y gestionar actividad_fotos.
-- =============================================================================

-- Defensa en profundidad: el rol anónimo nunca escribe.
revoke insert, update, delete, truncate on all tables in schema public from anon;

-- Tablas internas del panel: el visitante anónimo no tiene acceso alguno.
revoke all on public.perfiles, public.perfil_roles, public.registro_actividad, public.articulo_versiones from anon;

-- registro_actividad y articulo_versiones solo los escriben triggers.
revoke insert, update, delete, truncate on public.registro_actividad from authenticated;
revoke insert, update, delete, truncate on public.articulo_versiones from authenticated;

-- Funciones internas de triggers: no se exponen por la API.
revoke execute on function public.fijar_columnas_comunes() from public, anon, authenticated;
revoke execute on function public.fijar_creado_por_rol() from public, anon, authenticated;
revoke execute on function public.crear_perfil_para_usuario() from public, anon, authenticated;
revoke execute on function public.sincronizar_ingreso_usuario() from public, anon, authenticated;
revoke execute on function public.proteger_ultimo_superadmin() from public, anon, authenticated;
revoke execute on function public.registrar_actividad() from public, anon, authenticated;
revoke execute on function public.preparar_articulo() from public, anon, authenticated;
revoke execute on function public.guardar_version_articulo() from public, anon, authenticated;
revoke execute on function public.restaurar_articulo(uuid) from public, anon;

do $$
declare
  t text;
begin
  foreach t in array array[
    'perfiles', 'perfil_roles', 'registro_actividad',
    'fotos', 'series', 'temas', 'articulos', 'articulo_temas', 'articulo_versiones',
    'actividades', 'actividad_secciones', 'actividad_enlaces', 'actividad_fotos',
    'albumes', 'album_fotos', 'videos',
    'paginas', 'secciones', 'institucional', 'menu', 'configuracion', 'redirecciones'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Usuarios y roles (solo superadmin administra)
-- -----------------------------------------------------------------------------
create policy perfiles_leer on public.perfiles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.es_equipo()));

create policy perfiles_superadmin_insertar on public.perfiles
  for insert to authenticated
  with check ((select public.tiene_rol('superadmin')));

create policy perfiles_superadmin_editar on public.perfiles
  for update to authenticated
  using ((select public.tiene_rol('superadmin')))
  with check ((select public.tiene_rol('superadmin')));

create policy perfiles_superadmin_borrar on public.perfiles
  for delete to authenticated
  using ((select public.tiene_rol('superadmin')));

create policy perfil_roles_leer on public.perfil_roles
  for select to authenticated
  using (
    (select public.tiene_rol('superadmin'))
    or perfil_id in (select p.id from public.perfiles p where p.user_id = (select auth.uid()))
  );

create policy perfil_roles_superadmin_insertar on public.perfil_roles
  for insert to authenticated
  with check ((select public.tiene_rol('superadmin')));

create policy perfil_roles_superadmin_editar on public.perfil_roles
  for update to authenticated
  using ((select public.tiene_rol('superadmin')))
  with check ((select public.tiene_rol('superadmin')));

create policy perfil_roles_superadmin_borrar on public.perfil_roles
  for delete to authenticated
  using ((select public.tiene_rol('superadmin')));

create policy registro_actividad_superadmin_leer on public.registro_actividad
  for select to authenticated
  using ((select public.tiene_rol('superadmin')));

-- -----------------------------------------------------------------------------
-- Fotos
-- -----------------------------------------------------------------------------
create policy fotos_leer on public.fotos
  for select to anon, authenticated
  using ((select public.es_equipo()) or public.foto_es_publica(id));

create policy fotos_subir on public.fotos
  for insert to authenticated
  with check ((select public.es_equipo()));

create policy fotos_editar on public.fotos
  for update to authenticated
  using (
    (select public.tiene_algun_rol('superadmin', 'multimedia'))
    or ((select public.es_equipo()) and creado_por = (select auth.uid()))
  )
  with check (
    (select public.tiene_algun_rol('superadmin', 'multimedia'))
    or ((select public.es_equipo()) and creado_por = (select auth.uid()))
  );

create policy fotos_borrar on public.fotos
  for delete to authenticated
  using (
    (select public.tiene_algun_rol('superadmin', 'multimedia'))
    or ((select public.es_equipo()) and creado_por = (select auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- Artículos, series y temas (superadmin, editor)
-- -----------------------------------------------------------------------------
create policy series_leer on public.series
  for select to anon, authenticated using (true);
create policy series_escribir on public.series
  for all to authenticated
  using ((select public.tiene_algun_rol('superadmin', 'editor')))
  with check ((select public.tiene_algun_rol('superadmin', 'editor')));

create policy temas_leer on public.temas
  for select to anon, authenticated using (true);
create policy temas_escribir on public.temas
  for all to authenticated
  using ((select public.tiene_algun_rol('superadmin', 'editor')))
  with check ((select public.tiene_algun_rol('superadmin', 'editor')));

create policy articulos_leer on public.articulos
  for select to anon, authenticated
  using (
    estado = 'publicado'
    or (estado = 'programado' and publicar_en <= now())
    or (select public.tiene_algun_rol('superadmin', 'editor'))
  );

create policy articulos_crear on public.articulos
  for insert to authenticated
  with check ((select public.tiene_algun_rol('superadmin', 'editor')));

create policy articulos_editar on public.articulos
  for update to authenticated
  using ((select public.tiene_algun_rol('superadmin', 'editor')))
  with check ((select public.tiene_algun_rol('superadmin', 'editor')));

-- Borrado definitivo solo desde la papelera.
create policy articulos_borrar on public.articulos
  for delete to authenticated
  using ((select public.tiene_algun_rol('superadmin', 'editor')) and estado = 'papelera');

create policy articulo_temas_leer on public.articulo_temas
  for select to anon, authenticated
  using (
    (select public.tiene_algun_rol('superadmin', 'editor'))
    or exists (
      select 1 from public.articulos a
      where a.id = articulo_id
        and (a.estado = 'publicado' or (a.estado = 'programado' and a.publicar_en <= now()))
    )
  );
create policy articulo_temas_escribir on public.articulo_temas
  for all to authenticated
  using ((select public.tiene_algun_rol('superadmin', 'editor')))
  with check ((select public.tiene_algun_rol('superadmin', 'editor')));

create policy articulo_versiones_leer on public.articulo_versiones
  for select to authenticated
  using ((select public.tiene_algun_rol('superadmin', 'editor')));

-- -----------------------------------------------------------------------------
-- Eventos y actividades (superadmin, eventos; multimedia lee y gestiona fotos)
-- -----------------------------------------------------------------------------
create policy actividades_leer on public.actividades
  for select to anon, authenticated
  using (estado = 'publicado' or (select public.tiene_algun_rol('superadmin', 'eventos', 'multimedia')));

create policy actividades_escribir on public.actividades
  for all to authenticated
  using ((select public.tiene_algun_rol('superadmin', 'eventos')))
  with check ((select public.tiene_algun_rol('superadmin', 'eventos')));

create policy actividad_secciones_leer on public.actividad_secciones
  for select to anon, authenticated
  using (
    (select public.tiene_algun_rol('superadmin', 'eventos'))
    or exists (select 1 from public.actividades x where x.id = actividad_id and x.estado = 'publicado')
  );
create policy actividad_secciones_escribir on public.actividad_secciones
  for all to authenticated
  using ((select public.tiene_algun_rol('superadmin', 'eventos')))
  with check ((select public.tiene_algun_rol('superadmin', 'eventos')));

create policy actividad_enlaces_leer on public.actividad_enlaces
  for select to anon, authenticated
  using (
    (select public.tiene_algun_rol('superadmin', 'eventos'))
    or exists (select 1 from public.actividades x where x.id = actividad_id and x.estado = 'publicado')
  );
create policy actividad_enlaces_escribir on public.actividad_enlaces
  for all to authenticated
  using ((select public.tiene_algun_rol('superadmin', 'eventos')))
  with check ((select public.tiene_algun_rol('superadmin', 'eventos')));

create policy actividad_fotos_leer on public.actividad_fotos
  for select to anon, authenticated
  using (
    (select public.tiene_algun_rol('superadmin', 'eventos', 'multimedia'))
    or exists (select 1 from public.actividades x where x.id = actividad_id and x.estado = 'publicado')
  );
create policy actividad_fotos_escribir on public.actividad_fotos
  for all to authenticated
  using ((select public.tiene_algun_rol('superadmin', 'eventos', 'multimedia')))
  with check ((select public.tiene_algun_rol('superadmin', 'eventos', 'multimedia')));

-- -----------------------------------------------------------------------------
-- Galerías, álbumes y videos (superadmin, multimedia)
-- -----------------------------------------------------------------------------
create policy albumes_leer on public.albumes
  for select to anon, authenticated
  using (estado = 'publicado' or (select public.tiene_algun_rol('superadmin', 'multimedia')));
create policy albumes_escribir on public.albumes
  for all to authenticated
  using ((select public.tiene_algun_rol('superadmin', 'multimedia')))
  with check ((select public.tiene_algun_rol('superadmin', 'multimedia')));

create policy album_fotos_leer on public.album_fotos
  for select to anon, authenticated
  using (
    (select public.tiene_algun_rol('superadmin', 'multimedia'))
    or exists (select 1 from public.albumes al where al.id = album_id and al.estado = 'publicado')
  );
create policy album_fotos_escribir on public.album_fotos
  for all to authenticated
  using ((select public.tiene_algun_rol('superadmin', 'multimedia')))
  with check ((select public.tiene_algun_rol('superadmin', 'multimedia')));

create policy videos_leer on public.videos
  for select to anon, authenticated
  using (estado = 'publicado' or (select public.tiene_algun_rol('superadmin', 'multimedia')));
create policy videos_escribir on public.videos
  for all to authenticated
  using ((select public.tiene_algun_rol('superadmin', 'multimedia')))
  with check ((select public.tiene_algun_rol('superadmin', 'multimedia')));

-- -----------------------------------------------------------------------------
-- Página web, institucional, menú, configuración y redirecciones (superadmin)
-- -----------------------------------------------------------------------------
create policy paginas_leer on public.paginas
  for select to anon, authenticated
  using (estado = 'publicado' or (select public.tiene_rol('superadmin')));
create policy paginas_escribir on public.paginas
  for all to authenticated
  using ((select public.tiene_rol('superadmin')))
  with check ((select public.tiene_rol('superadmin')));

create policy secciones_leer on public.secciones
  for select to anon, authenticated
  using (
    (select public.tiene_rol('superadmin'))
    or (visible and exists (select 1 from public.paginas p where p.id = pagina_id and p.estado = 'publicado'))
  );
create policy secciones_escribir on public.secciones
  for all to authenticated
  using ((select public.tiene_rol('superadmin')))
  with check ((select public.tiene_rol('superadmin')));

create policy institucional_leer on public.institucional
  for select to anon, authenticated
  using (estado = 'publicado' or (select public.tiene_rol('superadmin')));
create policy institucional_escribir on public.institucional
  for all to authenticated
  using ((select public.tiene_rol('superadmin')))
  with check ((select public.tiene_rol('superadmin')));

create policy menu_leer on public.menu
  for select to anon, authenticated
  using (visible or (select public.tiene_rol('superadmin')));
create policy menu_escribir on public.menu
  for all to authenticated
  using ((select public.tiene_rol('superadmin')))
  with check ((select public.tiene_rol('superadmin')));

-- Lectura pública (el sitio necesita saber si está en mantenimiento).
create policy configuracion_leer on public.configuracion
  for select to anon, authenticated using (true);
create policy configuracion_editar on public.configuracion
  for update to authenticated
  using ((select public.tiene_rol('superadmin')))
  with check ((select public.tiene_rol('superadmin')));

create policy redirecciones_leer on public.redirecciones
  for select to anon, authenticated using (true);
create policy redirecciones_escribir on public.redirecciones
  for all to authenticated
  using ((select public.tiene_rol('superadmin')))
  with check ((select public.tiene_rol('superadmin')));
