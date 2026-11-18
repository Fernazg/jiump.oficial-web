-- Pruebas de la migración portada_videos: portada opcional de los videos,
-- elegida desde la biblioteca de fotos.
-- Ejecutar con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(10);

create function pg_temp.crear_usuario(p_id uuid, p_correo text, p_roles rol_app[])
returns void language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_correo, jsonb_build_object('nombre', split_part(p_correo, '@', 1)));
  insert into perfil_roles (perfil_id, rol)
  select p.id, r from perfiles p, unnest(p_roles) r where p.user_id = p_id;
end $$;

create function pg_temp.como(p_id uuid)
returns void language plpgsql as $$
declare
  sesion uuid := gen_random_uuid();
begin
  perform set_config('role', 'postgres', true);
  insert into auth.sessions (id, user_id, aal, created_at, updated_at) values (sesion, p_id, 'aal1', now(), now());
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated', 'aal', 'aal1', 'session_id', sesion)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
grant execute on function pg_temp.como(uuid) to authenticated;

select pg_temp.crear_usuario('d1000000-0000-4000-8000-000000000001', 'multimediavideo@pgtap.prueba', '{multimedia}');

insert into fotos (id, archivo, texto_alternativo) values
  ('d2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001/portada-video.jpg', 'Portada de prueba');
insert into videos (id, titulo, url, portada_foto_id) values
  ('d3000000-0000-4000-8000-000000000001', 'Video con portada', 'https://www.youtube.com/watch?v=portada123', 'd2000000-0000-4000-8000-000000000001');

-- Un video en borrador no vuelve pública su portada
set local role anon;
select is(foto_es_publica('d2000000-0000-4000-8000-000000000001'), false, 'La portada de un video en borrador no es pública');
select is((select count(*)::int from fotos where id = 'd2000000-0000-4000-8000-000000000001'), 0, 'El visitante no ve esa foto');
reset role;

-- Publicado: la portada es pública y el visitante lee la columna
update videos set estado = 'publicado' where id = 'd3000000-0000-4000-8000-000000000001';
set local role anon;
select is(foto_es_publica('d2000000-0000-4000-8000-000000000001'), true, 'La portada de un video publicado es pública');
select is((select count(*)::int from fotos where id = 'd2000000-0000-4000-8000-000000000001'), 1, 'El visitante ve la foto de portada');
select is((select portada_foto_id from videos where id = 'd3000000-0000-4000-8000-000000000001'),
  'd2000000-0000-4000-8000-000000000001'::uuid, 'El visitante lee la portada del video');
reset role;

-- Dónde se usa la foto
select pg_temp.como('d1000000-0000-4000-8000-000000000001');
select ok(exists (select 1 from usos_fotos(array['d2000000-0000-4000-8000-000000000001'::uuid])
  where tipo = 'Portada de video' and titulo = 'Video con portada' and publicado), 'Multimedia ve que la foto es portada de un video');

-- Guardar un video en borrador con portada (la misma función que usa el panel)
reset role;
insert into videos (id, titulo, url) values ('d3000000-0000-4000-8000-000000000002', 'Video sin portada', 'https://www.youtube.com/watch?v=sinportada1');
select pg_temp.como('d1000000-0000-4000-8000-000000000001');
select lives_ok($$ select aplicar_video('d3000000-0000-4000-8000-000000000002', jsonb_build_object(
    'url', 'https://www.youtube.com/watch?v=sinportada1', 'titulo', 'Video sin portada',
    'portada_foto_id', 'd2000000-0000-4000-8000-000000000001')) $$, 'Multimedia guarda la portada de un video');
select is((select portada_foto_id from videos where id = 'd3000000-0000-4000-8000-000000000002'),
  'd2000000-0000-4000-8000-000000000001'::uuid, 'La portada quedó guardada');
select lives_ok($$ select aplicar_video('d3000000-0000-4000-8000-000000000002', jsonb_build_object(
    'url', 'https://www.youtube.com/watch?v=sinportada1', 'titulo', 'Video sin portada', 'portada_foto_id', '')) $$,
  'Quitar la portada (vacío) también funciona');
reset role;

-- Eliminar la foto deja el video publicado sin portada (no se rompe)
delete from fotos where id = 'd2000000-0000-4000-8000-000000000001';
select is((select portada_foto_id from videos where id = 'd3000000-0000-4000-8000-000000000001'), null,
  'Al eliminar la foto, el video publicado queda sin portada');

select * from finish();
rollback;
