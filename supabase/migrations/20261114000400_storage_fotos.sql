-- =============================================================================
-- JIUMP · Migración 4: bucket de fotos y sus políticas
--
-- Bucket «fotos» con lectura pública por URL (rendimiento y caché del sitio;
-- las rutas incluyen un UUID y no se pueden adivinar). Listar, subir, editar y
-- borrar pasa por las políticas de abajo. Si la directiva prefiere ocultar
-- también por URL las fotos aún no publicadas, basta con poner public = false:
-- la política de lectura ya limita a fotos usadas en contenido publicado.
--
-- Convención de rutas: <user_id>/<uuid>.<ext> para originales y
-- <user_id>/<uuid>/<ancho>.webp para versiones optimizadas.
-- Las transformaciones de imagen de Supabase son de pago: las versiones
-- optimizadas las genera la app al subir.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos', 'fotos', true,
  10 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ¿El objeto corresponde a una foto (o a una versión de ella) usada en contenido público?
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
           or p_nombre like regexp_replace(f.archivo, '\.[^./]+$', '') || '/%')
      and public.foto_es_publica(f.id)
  );
$$;
grant execute on function public.objeto_foto_es_publico(text) to anon, authenticated, service_role;

create policy "fotos: leer" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'fotos'
    and ((select public.es_equipo()) or public.objeto_foto_es_publico(name))
  );

-- Cualquier rol del panel sube fotos, solo dentro de su propia carpeta.
create policy "fotos: subir" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and (select public.es_equipo())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Superadmin y Multimedia editan/borran cualquiera; Editor y Eventos solo las propias.
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
    and (
      (select public.tiene_algun_rol('superadmin', 'multimedia'))
      or ((select public.es_equipo()) and owner_id = (select auth.uid())::text)
    )
  );

create policy "fotos: borrar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fotos'
    and (
      (select public.tiene_algun_rol('superadmin', 'multimedia'))
      or ((select public.es_equipo()) and owner_id = (select auth.uid())::text)
    )
  );
