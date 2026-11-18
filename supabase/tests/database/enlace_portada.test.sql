-- Pruebas de la migración portada_enlaces: portada opcional de los «Videos y
-- transmisiones» de una actividad (actividad_enlaces).
-- Ejecutar con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

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

select pg_temp.crear_usuario('e1000000-0000-4000-8000-000000000001', 'eventosenlace@pgtap.prueba', '{eventos}');

insert into fotos (id, archivo, texto_alternativo) values
  ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001/portada-enlace.jpg', 'Portada de transmisión');
insert into actividades (id, titulo, slug, tipo, anio) values
  ('e3000000-0000-4000-8000-000000000001', 'Actividad con transmisión', 'actividad-con-transmision', 'zonal', 2027);

-- Guardar la actividad con un enlace con portada (la función que usa el panel)
select pg_temp.como('e1000000-0000-4000-8000-000000000001');
create temp table h as select huella_contenido('actividad', 'e3000000-0000-4000-8000-000000000001') as antes;
select lives_ok($$ select guardar_contenido('actividad', 'e3000000-0000-4000-8000-000000000001',
    (select actualizado_en from actividades where id = 'e3000000-0000-4000-8000-000000000001'),
    '{"titulo":"Actividad con transmisión","slug":"actividad-con-transmision","tipo":"zonal","anio":2027,
      "enlaces":[{"titulo":"Transmisión Día 1","url":"https://www.youtube.com/watch?v=dia1abcdefg","portada_foto_id":"e2000000-0000-4000-8000-000000000001"},
                 {"titulo":"Transmisión Día 2","url":"https://www.youtube.com/watch?v=dia2abcdefg","portada_foto_id":""}]}') $$,
  'Eventos guarda enlaces con y sin portada');
reset role;
select is((select array_agg(portada_foto_id::text order by orden) from actividad_enlaces where actividad_id = 'e3000000-0000-4000-8000-000000000001'),
  array['e2000000-0000-4000-8000-000000000001', null], 'Cada enlace guarda su portada (o ninguna)');
select isnt(huella_contenido('actividad', 'e3000000-0000-4000-8000-000000000001'), (select antes from h),
  'La portada cuenta en la huella de la vista previa');

-- Borrador: la portada no es pública. Publicada: sí.
set local role anon;
select is(foto_es_publica('e2000000-0000-4000-8000-000000000001'), false, 'La portada de un enlace de una actividad en borrador no es pública');
reset role;
update actividades set estado = 'publicado' where id = 'e3000000-0000-4000-8000-000000000001';
set local role anon;
select is(foto_es_publica('e2000000-0000-4000-8000-000000000001'), true, 'Con la actividad publicada, la portada es pública');
select is((select portada_foto_id from actividad_enlaces where titulo = 'Transmisión Día 1' and actividad_id = 'e3000000-0000-4000-8000-000000000001'),
  'e2000000-0000-4000-8000-000000000001'::uuid, 'El visitante lee la portada del enlace');
reset role;

-- Dónde se usa la foto
select pg_temp.como('e1000000-0000-4000-8000-000000000001');
select ok(exists (select 1 from usos_fotos(array['e2000000-0000-4000-8000-000000000001'::uuid])
  where tipo = 'Portada de video de actividad' and titulo = 'Actividad con transmisión'), 'Eventos ve que la foto es portada de un video de la actividad');
select throws_ok($$ update actividad_enlaces set portada_foto_id = null where actividad_id = 'e3000000-0000-4000-8000-000000000001' $$,
  'P0001', null, 'En una actividad publicada, la portada no se cambia directo (queda pendiente)');
reset role;

-- Eliminar la foto deja el enlace sin portada
delete from fotos where id = 'e2000000-0000-4000-8000-000000000001';
select is((select count(*)::int from actividad_enlaces where actividad_id = 'e3000000-0000-4000-8000-000000000001' and portada_foto_id is not null), 0,
  'Al eliminar la foto, el enlace queda sin portada');

select * from finish();
rollback;
