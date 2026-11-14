-- Pruebas de la migración 9 (panel /admin, etapa 2): versiones de fotos,
-- regla 2 (un evento por foto), usos de fotos, vista previa obligatoria de
-- actividades, álbumes y videos, y «Próximo evento».
-- Ejecutar con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(34);

create function pg_temp.crear_usuario(p_id uuid, p_correo text, p_roles rol_app[])
returns void language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_correo, jsonb_build_object('nombre', split_part(p_correo, '@', 1)));
  if 'superadmin' = any (p_roles) then
    insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
    values (gen_random_uuid(), p_id, 'totp', 'verified', now() - interval '1 day', now() - interval '1 day');
  end if;
  insert into perfil_roles (perfil_id, rol)
  select p.id, r from perfiles p, unnest(p_roles) r where p.user_id = p_id;
end $$;

create function pg_temp.como(p_id uuid, p_aal text default 'aal1')
returns void language plpgsql as $$
declare
  sesion uuid := gen_random_uuid();
begin
  perform set_config('role', 'postgres', true);
  insert into auth.sessions (id, user_id, aal, factor_id, created_at, updated_at)
  values (sesion, p_id, p_aal::auth.aal_level,
          case when p_aal = 'aal2' then (select id from auth.mfa_factors where user_id = p_id order by created_at limit 1) end,
          now(), now());
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal, 'session_id', sesion)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
grant execute on function pg_temp.como(uuid, text) to authenticated;

select pg_temp.crear_usuario('f1000000-0000-4000-8000-000000000001', 'editorfotos@pgtap.prueba', '{editor}');
select pg_temp.crear_usuario('f2000000-0000-4000-8000-000000000002', 'eventosfotos@pgtap.prueba', '{eventos}');
select pg_temp.crear_usuario('f3000000-0000-4000-8000-000000000003', 'multimediafotos@pgtap.prueba', '{multimedia}');

-- Datos de prueba (solo en esta transacción)
insert into fotos (id, archivo, texto_alternativo) values
  ('fa100000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000002/prueba-uno.jpg', 'Foto de prueba uno'),
  ('fa100000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000002/prueba-dos.jpg', 'Foto de prueba dos');
insert into actividades (id, titulo, slug, tipo, anio) values
  ('ac100000-0000-4000-8000-000000000001', 'Actividad de prueba A', 'actividad-prueba-a', 'zonal', 2027),
  ('ac100000-0000-4000-8000-000000000002', 'Actividad de prueba B', 'actividad-prueba-b', 'zonal', 2027);
insert into actividad_fotos (actividad_id, foto_id) values ('ac100000-0000-4000-8000-000000000001', 'fa100000-0000-4000-8000-000000000001');
insert into albumes (id, titulo, slug) values ('ab100000-0000-4000-8000-000000000001', 'Álbum de prueba', 'album-prueba');
insert into videos (id, titulo, url) values ('fb100000-0000-4000-8000-000000000001', 'Video de prueba', 'https://www.youtube.com/watch?v=prueba123');

-- -----------------------------------------------------------------------------
-- Versiones optimizadas
-- -----------------------------------------------------------------------------
select lives_ok($$ update fotos set anchos = '{480,960,1600}' where id = 'fa100000-0000-4000-8000-000000000001' $$,
  'Una foto guarda los anchos de sus versiones optimizadas');
select throws_ok($$ update fotos set anchos = '{0}' where id = 'fa100000-0000-4000-8000-000000000001' $$,
  '23514', null, 'Anchos inválidos se rechazan');

-- -----------------------------------------------------------------------------
-- Regla 2: un evento por foto
-- -----------------------------------------------------------------------------
select throws_ok($$ insert into album_fotos (album_id, foto_id) values ('ab100000-0000-4000-8000-000000000001', 'fa100000-0000-4000-8000-000000000001') $$,
  'P0001', 'Esta foto ya pertenece a otro evento: no se mezclan fotos de distintos eventos',
  'Una foto de una actividad no entra en un álbum de otro evento');
select throws_ok($$ insert into actividad_fotos (actividad_id, foto_id) values ('ac100000-0000-4000-8000-000000000002', 'fa100000-0000-4000-8000-000000000001') $$,
  '23505', null, 'Una foto no está en dos actividades');
update albumes set actividad_id = 'ac100000-0000-4000-8000-000000000001' where id = 'ab100000-0000-4000-8000-000000000001';
select lives_ok($$ insert into album_fotos (album_id, foto_id) values ('ab100000-0000-4000-8000-000000000001', 'fa100000-0000-4000-8000-000000000001') $$,
  'Sí entra en el álbum de su misma actividad');
select throws_ok($$ update albumes set actividad_id = 'ac100000-0000-4000-8000-000000000002' where id = 'ab100000-0000-4000-8000-000000000001' $$,
  'P0001', null, 'Un álbum con fotos de un evento no se asocia a otro');
select throws_ok($$ insert into album_fotos (album_id, foto_id)
  select id, 'fa100000-0000-4000-8000-000000000001' from albumes where slug = 'encuentro-de-mujeres-argentina' $$,
  null, null, 'Una foto no está en dos álbumes');
select throws_ok($$ insert into actividad_fotos (actividad_id, foto_id)
  select 'ac100000-0000-4000-8000-000000000002', foto_id from album_fotos af join albumes al on al.id = af.album_id
  where al.slug = 'convencion-nacional-2026' limit 1 $$,
  null, null, 'Una foto del álbum de la Convención no entra en otra actividad');
delete from album_fotos where album_id = 'ab100000-0000-4000-8000-000000000001';
update albumes set actividad_id = null where id = 'ab100000-0000-4000-8000-000000000001';

-- -----------------------------------------------------------------------------
-- Dónde se usa cada foto
-- -----------------------------------------------------------------------------
select pg_temp.como('f2000000-0000-4000-8000-000000000002');
select is((select titulo from usos_fotos(array['fa100000-0000-4000-8000-000000000001'::uuid])), 'Actividad de prueba A',
  'Eventos ve en qué actividad (aunque esté en borrador) se usa la foto');
select pg_temp.como('f1000000-0000-4000-8000-000000000001');
select is((select count(*)::int from usos_fotos(array['fa100000-0000-4000-8000-000000000001'::uuid])), 1,
  'Editor sabe que la foto está en uso…');
select is((select titulo from usos_fotos(array['fa100000-0000-4000-8000-000000000001'::uuid])), null,
  '…pero no ve el título de una actividad en borrador');
select ok(exists (select 1 from usos_fotos(array['a61090b0-3817-504b-bbc2-f71d6fcceaac'::uuid])
  where tipo = 'Artículo' and titulo = 'Cuando la verdad tuvo un precio'), 'Editor ve los artículos que usan la foto');
select is((select count(*)::int from usos_fotos(array['fa100000-0000-4000-8000-000000000002'::uuid])), 0,
  'Una foto sin usar no tiene usos');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select * from usos_fotos(array['fa100000-0000-4000-8000-000000000001'::uuid]) $$, '42501', null,
  'El visitante no consulta usos de fotos');
reset role;

-- -----------------------------------------------------------------------------
-- Vista previa obligatoria: actividades (Eventos)
-- -----------------------------------------------------------------------------
select pg_temp.como('f2000000-0000-4000-8000-000000000002');
select throws_ok($$ update actividades set estado = 'publicado' where id = 'ac100000-0000-4000-8000-000000000001' $$,
  'P0001', 'Antes de publicar hay que revisar la vista previa de este contenido', 'Una actividad no se publica sin vista previa');
select throws_ok($$ insert into actividades (titulo, slug, tipo, anio, estado) values ('x', 'publicada-directo', 'zonal', 2027, 'publicado') $$,
  'P0001', null, 'No se crea una actividad ya publicada');
select throws_ok($$ insert into vistas_previas_contenido (tipo, registro_id, huella) values ('actividad', 'ac100000-0000-4000-8000-000000000001', 'inventada') $$,
  '42501', null, 'La huella de la vista previa no se puede inventar');
insert into vistas_previas_contenido (tipo, registro_id, huella)
values ('actividad', 'ac100000-0000-4000-8000-000000000001', huella_contenido('actividad', 'ac100000-0000-4000-8000-000000000001'));
insert into actividad_secciones (actividad_id, titulo) values ('ac100000-0000-4000-8000-000000000001', 'Sección agregada después');
select throws_ok($$ update actividades set estado = 'publicado' where id = 'ac100000-0000-4000-8000-000000000001' $$,
  'P0001', null, 'Si cambian las secciones después de la vista previa, hay que verla de nuevo');
insert into vistas_previas_contenido (tipo, registro_id, huella)
values ('actividad', 'ac100000-0000-4000-8000-000000000001', huella_contenido('actividad', 'ac100000-0000-4000-8000-000000000001'));
select throws_ok($$ update actividades set estado = 'publicado', titulo = 'Cambiado al publicar' where id = 'ac100000-0000-4000-8000-000000000001' $$,
  'P0001', null, 'Publicar no puede cambiar a la vez el contenido');
select lives_ok($$ update actividades set estado = 'publicado' where id = 'ac100000-0000-4000-8000-000000000001' $$,
  'Con la vista previa del contenido guardado, se publica');
select lives_ok($$ update actividades set destacar_inicio = true, orden_inicio = 9 where id = 'ac100000-0000-4000-8000-000000000001' $$,
  'Destacar y ordenar en Inicio no exige vista previa');

-- Próximo evento: siempre uno solo
select lives_ok($$ select marcar_proximo('ac100000-0000-4000-8000-000000000001', true) $$, 'Eventos marca el próximo evento');
select lives_ok($$ select marcar_proximo('ac100000-0000-4000-8000-000000000002', true) $$, 'Marcar otro…');
select is((select array_agg(slug) from actividades where es_proximo), array['actividad-prueba-b']::text[], '…deja solo uno marcado');
select lives_ok($$ select marcar_proximo('ac100000-0000-4000-8000-000000000002', false) $$, 'Y se puede desmarcar');
select is((select count(*)::int from actividades where es_proximo), 0, 'Sin próximo evento');

-- Multimedia no publica actividades ni marca el próximo evento
select pg_temp.como('f3000000-0000-4000-8000-000000000003');
select throws_ok($$ insert into vistas_previas_contenido (tipo, registro_id, huella)
  values ('actividad', 'ac100000-0000-4000-8000-000000000002', huella_contenido('actividad', 'ac100000-0000-4000-8000-000000000002')) $$,
  '42501', null, 'Multimedia no registra vistas previas de actividades');
select throws_ok($$ select marcar_proximo('ac100000-0000-4000-8000-000000000001', true) $$, '42501', null,
  'Multimedia no marca el próximo evento');

-- -----------------------------------------------------------------------------
-- Vista previa obligatoria: álbumes y videos (Multimedia)
-- -----------------------------------------------------------------------------
select throws_ok($$ update albumes set estado = 'publicado' where id = 'ab100000-0000-4000-8000-000000000001' $$,
  'P0001', null, 'Un álbum no se publica sin vista previa');
insert into vistas_previas_contenido (tipo, registro_id, huella)
values ('album', 'ab100000-0000-4000-8000-000000000001', huella_contenido('album', 'ab100000-0000-4000-8000-000000000001'));
select lives_ok($$ update albumes set estado = 'publicado' where id = 'ab100000-0000-4000-8000-000000000001' $$,
  'Con vista previa, Multimedia publica el álbum');
select throws_ok($$ update videos set estado = 'publicado' where id = 'fb100000-0000-4000-8000-000000000001' $$,
  'P0001', null, 'Un video no se publica sin vista previa');
insert into vistas_previas_contenido (tipo, registro_id, huella)
values ('video', 'fb100000-0000-4000-8000-000000000001', huella_contenido('video', 'fb100000-0000-4000-8000-000000000001'));
select lives_ok($$ update videos set estado = 'publicado' where id = 'fb100000-0000-4000-8000-000000000001' $$,
  'Con vista previa, Multimedia publica el video');

select pg_temp.como('f1000000-0000-4000-8000-000000000001');
select throws_ok($$ insert into vistas_previas_contenido (tipo, registro_id, huella)
  values ('album', 'ab100000-0000-4000-8000-000000000001', huella_contenido('album', 'ab100000-0000-4000-8000-000000000001')) $$,
  '42501', null, 'Editor no registra vistas previas de álbumes');
reset role;

select ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public' and p.proname in ('huella_contenido', 'puede_editar_contenido', 'marcar_proximo', 'exigir_vista_previa_contenido')
                        and p.prosecdef),
  'Las funciones nuevas (salvo usos_fotos y la regla 2) respetan RLS');

select * from finish();
rollback;
