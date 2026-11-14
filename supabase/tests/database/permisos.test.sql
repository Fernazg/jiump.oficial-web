-- Pruebas de permisos (RLS) y reglas del modelo de datos.
-- Ejecutar con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(85);

-- -----------------------------------------------------------------------------
-- Preparación: usuarios de prueba (ficticios, solo existen dentro de esta
-- transacción) y utilidades para «iniciar sesión» como cada uno.
-- -----------------------------------------------------------------------------
create function pg_temp.crear_usuario(p_id uuid, p_correo text, p_roles rol_app[])
returns void language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_correo, jsonb_build_object('nombre', split_part(p_correo, '@', 1)));
  insert into perfil_roles (perfil_id, rol)
  select p.id, r from perfiles p, unnest(p_roles) r where p.user_id = p_id;
end $$;

create function pg_temp.como(p_id uuid, p_aal text default 'aal1')
returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal)::text, true);
$$;

select pg_temp.crear_usuario('11111111-1111-4111-8111-111111111111', 'super@pgtap.prueba', '{superadmin}');
select pg_temp.crear_usuario('22222222-2222-4222-8222-222222222222', 'editor@pgtap.prueba', '{editor}');
select pg_temp.crear_usuario('33333333-3333-4333-8333-333333333333', 'eventos@pgtap.prueba', '{eventos}');
select pg_temp.crear_usuario('44444444-4444-4444-8444-444444444444', 'multimedia@pgtap.prueba', '{multimedia}');
select pg_temp.crear_usuario('55555555-5555-4555-8555-555555555555', 'inactivo@pgtap.prueba', '{editor}');
select pg_temp.crear_usuario('66666666-6666-4666-8666-666666666666', 'eventosmm@pgtap.prueba', '{eventos,multimedia}');
update perfiles set activo = false where correo = 'inactivo@pgtap.prueba';

select is((select count(*)::int from perfiles where correo like '%@pgtap.prueba'), 6,
  'Se crea un perfil automáticamente por cada usuario de auth');

-- Fotos de prueba subidas por el editor y por multimedia (fotos reales del seed reutilizadas).
insert into fotos (id, archivo, texto_alternativo, creado_por)
values ('f0000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222/a.jpg', 'Foto del editor', '22222222-2222-4222-8222-222222222222'),
       ('f0000000-0000-4000-8000-000000000002', '44444444-4444-4444-8444-444444444444/b.jpg', 'Foto de multimedia', '44444444-4444-4444-8444-444444444444');

-- =============================================================================
-- 1. Visitante anónimo: solo lectura de lo publicado
-- =============================================================================
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*)::int from articulos), 6, 'Anónimo ve los 6 artículos publicados');
select is((select count(*)::int from articulos where estado = 'revision'), 0, 'Anónimo no ve artículos en revisión');
select is((select count(*)::int from actividades), 4, 'Anónimo ve las 4 actividades publicadas');
select is((select count(*)::int from albumes), 1, 'Anónimo solo ve el álbum publicado');
select ok((select count(*) from album_fotos) > 0, 'Anónimo lee las fotos del álbum publicado');
select is((select count(*)::int from videos), 0, 'Anónimo no ve videos en borrador');
select is((select count(*)::int from paginas), 0, 'Anónimo no ve páginas en borrador');
select is((select count(*)::int from configuracion), 1, 'Anónimo lee la configuración (modo mantenimiento)');
select is((select count(*)::int from menu), 4, 'Anónimo lee el menú');
select is((select count(*)::int from series), 6, 'Anónimo lee las series');
select throws_ok($$ select count(*) from perfiles $$, '42501', null, 'Anónimo no ve perfiles');
select throws_ok($$ select count(*) from perfil_roles $$, '42501', null, 'Anónimo no ve roles');
select throws_ok($$ select count(*) from articulo_versiones $$, '42501', null, 'Anónimo no ve versiones');
select is((select count(*)::int from fotos where id = 'f0000000-0000-4000-8000-000000000001'), 0,
  'Anónimo no ve fotos que no se usan en contenido publicado');
select ok((select count(*) from fotos) > 0, 'Anónimo ve las fotos usadas en contenido publicado');
select ok(not exists (select 1 from fotos f where not foto_es_publica(f.id)), 'Toda foto visible para anónimo está publicada');
select throws_ok($$ select count(*) from registro_actividad $$, '42501', null, 'Anónimo no puede leer el registro de actividad');
select throws_ok($$ insert into articulos (titulo, slug) values ('x', 'x') $$, '42501', null, 'Anónimo no puede crear artículos');
select throws_ok($$ update configuracion set modo_mantenimiento = true $$, '42501', null, 'Anónimo no puede activar mantenimiento');
select throws_ok($$ insert into fotos (archivo, texto_alternativo) values ('x.jpg', 'x') $$, '42501', null, 'Anónimo no puede subir fotos');

-- Búsqueda en español, sin tildes
select is((select count(*)::int from buscar_articulos('reforma')), 2,
  'Buscar «reforma» devuelve solo los artículos publicados de la Reforma');
select is((select titulo from buscar_articulos('como comenzo')), '¿Cómo comenzó la Biblia?',
  'La búsqueda ignora tildes y signos');

reset role;

-- =============================================================================
-- 2. Editor: artículos, series y temas; fotos propias
-- =============================================================================
set local role authenticated;
select pg_temp.como('22222222-2222-4222-8222-222222222222');

select is((select count(*)::int from articulos), 7, 'Editor ve todos los artículos, incluido el que está en revisión');
select lives_ok($$ insert into articulos (id, titulo, slug, cuerpo)
  values ('e0000000-0000-4000-8000-000000000001', 'Prueba', 'prueba-editor',
          '[{"tipo":"parrafo","texto":"uno dos tres"}]') $$, 'Editor crea artículos');
select is((select creado_por from articulos where slug = 'prueba-editor'), '22222222-2222-4222-8222-222222222222'::uuid,
  'creado_por lo fija el servidor');
select lives_ok($$ insert into temas (nombre, slug) values ('Tema prueba', 'tema-prueba') $$, 'Editor crea temas');
select lives_ok($$ insert into articulo_temas (articulo_id, tema_id)
  select 'e0000000-0000-4000-8000-000000000001', id from temas where slug = 'tema-prueba' $$, 'Editor asigna temas');
select throws_ok($$ insert into actividades (titulo, slug, tipo, anio) values ('x', 'x', 'zonal', 2026) $$,
  '42501', null, 'Editor no puede crear actividades');
select throws_ok($$ insert into albumes (titulo, slug) values ('x', 'x') $$, '42501', null, 'Editor no puede crear álbumes');
select is((select count(*)::int from albumes where estado = 'borrador'), 0, 'Editor no ve álbumes en borrador');
select is((select count(*)::int from registro_actividad), 0, 'Editor no ve el registro de actividad');
select is((select count(*)::int from perfil_roles), 1, 'Editor solo ve sus propios roles');
select is((select array_agg(r)::text from mis_roles() r), '{editor}', 'mis_roles() devuelve los roles del usuario');

-- Fotos: ◐ sube y edita las propias, no las de otros
select lives_ok($$ insert into fotos (archivo, texto_alternativo) values ('22222222-2222-4222-8222-222222222222/c.jpg', 'Otra foto') $$,
  'Editor sube fotos');
select throws_ok($$ insert into fotos (archivo, texto_alternativo) values ('22222222-2222-4222-8222-222222222222/d.jpg', '  ') $$,
  '23514', null, 'El texto alternativo es obligatorio');
update fotos set credito = 'propio' where id = 'f0000000-0000-4000-8000-000000000001';
select is((select credito from fotos where id = 'f0000000-0000-4000-8000-000000000001'), 'propio', 'Editor edita sus fotos');
update fotos set credito = 'ajeno' where id = 'f0000000-0000-4000-8000-000000000002';
select is((select credito from fotos where id = 'f0000000-0000-4000-8000-000000000002'), null, 'Editor no edita fotos de otros');
delete from fotos where id = 'f0000000-0000-4000-8000-000000000002';
select is((select count(*)::int from fotos where id = 'f0000000-0000-4000-8000-000000000002'), 1, 'Editor no borra fotos de otros');

-- Configuración: sin acceso
update configuracion set modo_mantenimiento = true;
select is((select modo_mantenimiento from configuracion), false, 'Editor no puede activar el modo mantenimiento');
select throws_ok($$ insert into perfil_roles (perfil_id, rol) select id, 'superadmin' from perfiles where correo = 'editor@pgtap.prueba' $$,
  '42501', null, 'Editor no puede darse el rol de superadmin');

-- Papelera y versiones
delete from articulos where id = 'e0000000-0000-4000-8000-000000000001';
select is((select count(*)::int from articulos where id = 'e0000000-0000-4000-8000-000000000001'), 1,
  'Un artículo fuera de la papelera no se puede borrar');
update articulos set titulo = 'Prueba editada' where id = 'e0000000-0000-4000-8000-000000000001';
select is((select count(*)::int from articulo_versiones where articulo_id = 'e0000000-0000-4000-8000-000000000001'), 1,
  'Editar guarda la versión anterior');
select is((select titulo from articulo_versiones where articulo_id = 'e0000000-0000-4000-8000-000000000001'), 'Prueba',
  'La versión guardada conserva el título anterior');
update articulos set estado = 'papelera' where id = 'e0000000-0000-4000-8000-000000000001';
select ok((select en_papelera_desde is not null from articulos where id = 'e0000000-0000-4000-8000-000000000001'),
  'Pasar a la papelera registra la fecha');
select is((select (restaurar_articulo('e0000000-0000-4000-8000-000000000001')).estado), 'borrador'::estado_articulo,
  'Restaurar desde la papelera vuelve al estado anterior');
update articulos set estado = 'papelera' where id = 'e0000000-0000-4000-8000-000000000001';
delete from articulos where id = 'e0000000-0000-4000-8000-000000000001';
select is((select count(*)::int from articulos where id = 'e0000000-0000-4000-8000-000000000001'), 0,
  'Un artículo en la papelera sí se puede borrar');
select throws_ok($$ select purgar_papelera_articulos() $$, '42501', null, 'Solo el servidor vacía la papelera');

-- Series con artículos no se borran
select throws_ok($$ delete from series where slug = 'mes-de-la-biblia' $$, '23503', null,
  'Una serie con artículos no se puede borrar');

-- Programados
insert into articulos (id, titulo, slug, estado, publicar_en) values
  ('e0000000-0000-4000-8000-000000000002', 'Programado pasado', 'programado-pasado', 'programado', now() - interval '1 hour'),
  ('e0000000-0000-4000-8000-000000000003', 'Programado futuro', 'programado-futuro', 'programado', now() + interval '1 day');
select throws_ok($$ insert into articulos (titulo, slug, estado) values ('x', 'sin-fecha', 'programado') $$,
  '23514', null, 'Un artículo programado necesita fecha');
select throws_ok($$ insert into articulos (titulo, slug, serie_id, parte)
  select 'x', 'parte-repetida', id, 1 from series where slug = 'mes-de-la-biblia' $$,
  '23505', null, 'No se repite el número de parte dentro de una serie');
select throws_ok($$ insert into articulos (titulo, slug) values ('x', 'Slug Inválido') $$, '23514', null, 'Los slugs se validan');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from articulos where slug like 'programado-%'), 1,
  'Un artículo programado aparece solo cuando llega su fecha');
reset role;

-- =============================================================================
-- 3. Eventos
-- =============================================================================
set local role authenticated;
select pg_temp.como('33333333-3333-4333-8333-333333333333');

select lives_ok($$ insert into actividades (id, titulo, slug, tipo, anio, fecha_inicio, fecha_precision, es_proximo)
  values ('e0000000-0000-4000-8000-000000000010', 'Actividad prueba', 'actividad-prueba', 'zonal', 2027, '2027-03-01', 'mes', true) $$,
  'Eventos crea actividades (con solo mes y año)');
select throws_ok($$ insert into actividades (titulo, slug, tipo, anio, es_proximo) values ('x', 'otra-proxima', 'zonal', 2027, true) $$,
  '23505', null, 'Solo una actividad puede ser «Próximo evento»');
select throws_ok($$ insert into actividades (titulo, slug, tipo, anio, fecha_inicio) values ('x', 'anio-malo', 'zonal', 2026, '2027-01-01') $$,
  '23514', null, 'El año debe coincidir con la fecha');
select lives_ok($$ insert into actividad_secciones (actividad_id, titulo) values ('e0000000-0000-4000-8000-000000000010', 'Día 1') $$,
  'Eventos edita secciones de la actividad');
select lives_ok($$ insert into actividad_enlaces (actividad_id, titulo, url) values ('e0000000-0000-4000-8000-000000000010', 'Transmisión', 'https://www.youtube.com/watch?v=XIn6jmUKxH0') $$,
  'Eventos agrega enlaces');
select lives_ok($$ insert into actividad_fotos (actividad_id, foto_id) values ('e0000000-0000-4000-8000-000000000010', 'f0000000-0000-4000-8000-000000000002') $$,
  'Eventos usa fotos de la biblioteca en su actividad');
select throws_ok($$ insert into articulos (titulo, slug) values ('x', 'x-eventos') $$, '42501', null, 'Eventos no crea artículos');
select is((select count(*)::int from articulos where estado = 'revision'), 0, 'Eventos no ve artículos en revisión');
select throws_ok($$ insert into videos (titulo, url) values ('x', 'https://youtu.be/x') $$, '42501', null, 'Eventos no crea videos');
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from actividad_secciones), 0, 'Anónimo no ve secciones de actividades en borrador');
reset role;

-- =============================================================================
-- 4. Multimedia
-- =============================================================================
set local role authenticated;
select pg_temp.como('44444444-4444-4444-8444-444444444444');

select lives_ok($$ insert into albumes (titulo, slug) values ('Álbum prueba', 'album-prueba') $$, 'Multimedia crea álbumes');
select lives_ok($$ insert into videos (titulo, url) values ('Video prueba', 'https://youtu.be/XIn6jmUKxH0') $$, 'Multimedia crea videos');
select throws_ok($$ insert into videos (titulo, url) values ('x', 'https://vimeo.com/1') $$, '23514', null, 'Los videos son de YouTube');
update fotos set credito = 'mm' where id = 'f0000000-0000-4000-8000-000000000001';
select is((select credito from fotos where id = 'f0000000-0000-4000-8000-000000000001'), 'mm', 'Multimedia edita cualquier foto');
select is((select count(*)::int from actividades where estado = 'borrador'), 1, 'Multimedia ve actividades en borrador para vincularlas');
select throws_ok($$ insert into actividades (titulo, slug, tipo, anio) values ('x', 'x-mm', 'zonal', 2026) $$, '42501', null, 'Multimedia no crea actividades');
select throws_ok($$ insert into articulos (titulo, slug) values ('x', 'x-mm') $$, '42501', null, 'Multimedia no crea artículos');
reset role;

-- Persona con dos roles (eventos + multimedia)
set local role authenticated;
select pg_temp.como('66666666-6666-4666-8666-666666666666');
select lives_ok($$ insert into actividades (titulo, slug, tipo, anio) values ('x', 'doble-rol', 'zonal', 2026) $$, 'Con dos roles suma permisos: crea actividades');
select lives_ok($$ insert into albumes (titulo, slug) values ('x', 'doble-rol') $$, 'Con dos roles suma permisos: crea álbumes');
reset role;

-- Usuario inactivo
set local role authenticated;
select pg_temp.como('55555555-5555-4555-8555-555555555555');
select throws_ok($$ insert into articulos (titulo, slug) values ('x', 'x-inactivo') $$, '42501', null, 'Un usuario desactivado pierde sus permisos');
select is((select count(*)::int from articulos where estado = 'revision'), 0, 'Un usuario desactivado solo ve lo público');
reset role;

-- =============================================================================
-- 5. Superadministrador: exige doble factor (aal2)
-- =============================================================================
set local role authenticated;
select pg_temp.como('11111111-1111-4111-8111-111111111111', 'aal1');
update configuracion set modo_mantenimiento = true;
select is((select modo_mantenimiento from configuracion), false, 'Superadmin sin doble factor no administra');
select is((select count(*)::int from registro_actividad), 0, 'Superadmin sin doble factor no ve el registro');
select is((select array_agg(r)::text from mis_roles() r), '{superadmin}', 'mis_roles() avisa que es superadmin para pedir el 2FA');

select pg_temp.como('11111111-1111-4111-8111-111111111111', 'aal2');
update configuracion set modo_mantenimiento = true;
select is((select modo_mantenimiento from configuracion), true, 'Superadmin con doble factor activa el modo mantenimiento');
select lives_ok($$ update paginas set estado = 'publicado' where clave = 'inicio' $$, 'Superadmin publica páginas');
select lives_ok($$ insert into perfil_roles (perfil_id, rol) select id, 'multimedia' from perfiles where correo = 'editor@pgtap.prueba' $$,
  'Superadmin asigna roles');
select ok((select count(*) from registro_actividad where accion = 'asignar_rol') >= 1, 'El cambio de rol queda registrado');
select ok(exists (select 1 from registro_actividad where tabla = 'paginas' and accion = 'publicar'), 'Publicar queda registrado');
select ok(exists (select 1 from registro_actividad r join perfiles p on p.id = r.perfil_id
                  where r.tabla = 'articulos' and r.accion = 'papelera' and p.correo = 'editor@pgtap.prueba'),
  'El registro guarda quién envió a la papelera');
select is((select count(*)::int from articulos), 9, 'Superadmin ve todos los artículos, incluidos los programados');

-- No se puede quitar el último superadmin
delete from perfil_roles where rol = 'superadmin';
select throws_ok($$ set constraints all immediate $$, '23514', null, 'No se puede quitar el último superadmin');

reset role;

select * from finish();
rollback;
