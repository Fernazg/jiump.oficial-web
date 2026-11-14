-- =============================================================================
-- JIUMP · Migración 6: correcciones de la revisión de seguridad
-- Cada bloque corresponde a un hallazgo; las pruebas están en
-- supabase/tests/database/seguridad.test.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- H1 · Fotos no publicadas descargables por URL
-- El bucket era público: cualquiera con la URL veía fotos aún no publicadas o
-- ya retiradas (y la URL queda en cachés). Ahora es privado y la lectura pasa
-- siempre por la política «fotos: leer» (solo fotos usadas en contenido
-- publicado). El sitio muestra las fotos con URL firmadas.
-- -----------------------------------------------------------------------------
update storage.buckets set public = false where id = 'fotos';

-- -----------------------------------------------------------------------------
-- H2 · Doble factor evitable + H6 · sesión cerrada que seguía funcionando
-- Antes bastaba con que el JWT dijera aal2. Si el rol se asignaba antes de que
-- la persona inscribiera su factor, quien robara la contraseña inscribía su
-- propio factor y obtenía aal2. Ahora:
--   · todos los roles exigen que la sesión del JWT siga viva en auth.sessions
--     (cerrar sesión o desactivar a alguien corta el acceso al instante, sin
--     esperar a que venza el token);
--   · superadmin exige además una sesión aal2 verificada con un factor que ya
--     existía cuando se le asignó el rol.
-- -----------------------------------------------------------------------------
create or replace function public.tiene_algun_rol(variadic roles public.rol_app[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles p
    join public.perfil_roles pr on pr.perfil_id = p.id
    join auth.sessions s on s.user_id = p.user_id
    where p.user_id = auth.uid()
      and s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      and (s.not_after is null or s.not_after > now())
      and p.activo
      and pr.rol = any (roles)
      and (
        pr.rol <> 'superadmin'
        or (
          coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
          and s.aal = 'aal2'
          and exists (
            select 1
            from auth.mfa_factors f
            where f.id = s.factor_id
              and f.user_id = p.user_id
              and f.status = 'verified'
              and f.created_at <= pr.creado_en
          )
        )
      )
  );
$$;

create or replace function public.tiene_rol(r public.rol_app)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.tiene_algun_rol(r);
$$;

-- -----------------------------------------------------------------------------
-- H7 · Las asignaciones de rol se podían editar
-- Al editar perfil_roles se podía falsear creado_en (que usa la regla del
-- doble factor). Un rol solo se asigna o se quita.
-- -----------------------------------------------------------------------------
drop policy perfil_roles_superadmin_editar on public.perfil_roles;
revoke update on public.perfil_roles from authenticated, anon;

-- -----------------------------------------------------------------------------
-- H5 · Todo el equipo veía los correos, el estado y el último ingreso de todos
-- La matriz reserva «Usuarios» al superadmin. Cada persona ve solo su perfil.
-- -----------------------------------------------------------------------------
drop policy perfiles_leer on public.perfiles;
create policy perfiles_leer on public.perfiles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.tiene_rol('superadmin')));

-- -----------------------------------------------------------------------------
-- H4 · Multimedia tenía más permisos que los de la matriz
-- Leía actividades en borrador y gestionaba las fotos de las actividades
-- («Eventos y actividades» es solo de Superadmin y Eventos). Multimedia puede
-- vincular sus álbumes y videos a actividades publicadas.
-- -----------------------------------------------------------------------------
drop policy actividades_leer on public.actividades;
create policy actividades_leer on public.actividades
  for select to anon, authenticated
  using (estado = 'publicado' or (select public.tiene_algun_rol('superadmin', 'eventos')));

drop policy actividad_fotos_leer on public.actividad_fotos;
create policy actividad_fotos_leer on public.actividad_fotos
  for select to anon, authenticated
  using (
    (select public.tiene_algun_rol('superadmin', 'eventos'))
    or exists (select 1 from public.actividades x where x.id = actividad_id and x.estado = 'publicado')
  );

drop policy actividad_fotos_escribir on public.actividad_fotos;
create policy actividad_fotos_escribir on public.actividad_fotos
  for all to authenticated
  using ((select public.tiene_algun_rol('superadmin', 'eventos')))
  with check ((select public.tiene_algun_rol('superadmin', 'eventos')));

-- -----------------------------------------------------------------------------
-- H8 · Series y temas sin artículos publicados eran visibles
-- Revelaban contenido planificado. El público ve solo las que tienen al menos
-- un artículo visible; Superadmin y Editor ven todas.
-- -----------------------------------------------------------------------------
drop policy series_leer on public.series;
create policy series_leer on public.series
  for select to anon, authenticated
  using (
    (select public.tiene_algun_rol('superadmin', 'editor'))
    or exists (
      select 1 from public.articulos a
      where a.serie_id = series.id
        and (a.estado = 'publicado' or (a.estado = 'programado' and a.publicar_en <= now()))
    )
  );

drop policy temas_leer on public.temas;
create policy temas_leer on public.temas
  for select to anon, authenticated
  using (
    (select public.tiene_algun_rol('superadmin', 'editor'))
    or exists (
      select 1 from public.articulo_temas at
      join public.articulos a on a.id = at.articulo_id
      where at.tema_id = temas.id
        and (a.estado = 'publicado' or (a.estado = 'programado' and a.publicar_en <= now()))
    )
  );

-- -----------------------------------------------------------------------------
-- H3 · Mover archivos a la carpeta de otra persona
-- La política de edición del bucket no revisaba el nombre NUEVO: con «mover»
-- se podía dejar un archivo en la carpeta de otra persona (por ejemplo, en la
-- ruta de una foto ya publicada). Ahora cada archivo vive siempre en la
-- carpeta de su dueño, y al subir el dueño debe ser quien sube.
-- -----------------------------------------------------------------------------
drop policy "fotos: subir" on storage.objects;
create policy "fotos: subir" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and (select public.es_equipo())
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and owner_id = (select auth.uid())::text
  );

drop policy "fotos: editar" on storage.objects;
create policy "fotos: editar" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'fotos'
    and (
      (select public.tiene_algun_rol('superadmin', 'multimedia'))
      or ((select public.es_equipo()) and owner_id = (select auth.uid())::text)
    )
  )
  with check (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = owner_id
    and (
      (select public.tiene_algun_rol('superadmin', 'multimedia'))
      or ((select public.es_equipo()) and owner_id = (select auth.uid())::text)
    )
  );

-- -----------------------------------------------------------------------------
-- H9 · fotos.archivo sin validar
-- Se podía registrar una foto que apuntara al archivo de otra persona, cambiar
-- el archivo de una foto ya publicada o usar comodines de LIKE («%», «_») para
-- que objeto_foto_es_publico() diera por publicado cualquier archivo.
-- -----------------------------------------------------------------------------
alter table public.fotos
  add constraint fotos_archivo_valido
  check (archivo ~ '^[a-z0-9-]+/[a-z0-9-]+\.(jpg|jpeg|png|webp|avif)$');

drop policy fotos_subir on public.fotos;
create policy fotos_subir on public.fotos
  for insert to authenticated
  with check (
    (select public.es_equipo())
    and split_part(archivo, '/', 1) = (select auth.uid())::text
  );

create or replace function public.proteger_archivo_foto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.archivo is distinct from old.archivo then
    raise exception 'El archivo de una foto no se cambia: sube una foto nueva'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function public.proteger_archivo_foto() from public, anon, authenticated;

create trigger fotos_archivo_inmutable
  before update of archivo on public.fotos
  for each row execute function public.proteger_archivo_foto();

create or replace function public.objeto_foto_es_publico(p_nombre text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.fotos f
    where (f.archivo = p_nombre
           or starts_with(p_nombre, regexp_replace(f.archivo, '\.[^./]+$', '') || '/'))
      and public.foto_es_publica(f.id)
  );
$$;

-- -----------------------------------------------------------------------------
-- H6 · Desactivar a alguien no cerraba su sesión
-- La base ya le negaba los permisos, pero podía seguir renovando su sesión y
-- usando la API de autenticación (cambiar correo, contraseña o factores).
-- Ahora desactivar cierra todas sus sesiones y bloquea el inicio de sesión;
-- reactivar lo desbloquea.
-- -----------------------------------------------------------------------------
create or replace function public.aplicar_estado_activo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.activo then
    update auth.users set banned_until = null where id = new.user_id;
  else
    update auth.users set banned_until = now() + interval '100 years' where id = new.user_id;
    delete from auth.sessions where user_id = new.user_id;  -- borra también sus refresh tokens
  end if;
  return null;
end;
$$;
revoke execute on function public.aplicar_estado_activo() from public, anon, authenticated;

create trigger perfiles_estado_activo
  after update of activo on public.perfiles
  for each row
  when (old.activo is distinct from new.activo)
  execute function public.aplicar_estado_activo();

-- -----------------------------------------------------------------------------
-- H10 · Privilegios por defecto demasiado amplios para el futuro
-- Supabase da por defecto EXECUTE y escritura al rol anónimo sobre toda
-- función o tabla nueva del esquema public. Una migración futura que olvide
-- revocarlos dejaría expuesta una función SECURITY DEFINER o una tabla sin RLS.
-- Desde ahora, lo nuevo nace cerrado para el visitante y se abre a mano.
-- -----------------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;
-- PUBLIC recibe EXECUTE por el privilegio por defecto GLOBAL (no el del esquema).
alter default privileges for role postgres
  revoke execute on functions from public;
