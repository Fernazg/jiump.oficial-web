-- Pruebas de la migración 7: campos opcionales de actividades (lema, cita,
-- abreviatura) y foto de la página de mantenimiento.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(20);

-- -----------------------------------------------------------------------------
-- Columnas nuevas: existen, son opcionales y en el seed están vacías
-- -----------------------------------------------------------------------------
select has_column('actividades', 'lema', 'actividades.lema existe');
select has_column('actividades', 'cita_texto', 'actividades.cita_texto existe');
select has_column('actividades', 'cita_referencia', 'actividades.cita_referencia existe');
select has_column('actividades', 'abreviatura', 'actividades.abreviatura existe');
select has_column('configuracion', 'mantenimiento_foto_id', 'configuracion.mantenimiento_foto_id existe');
select col_is_null('actividades', 'lema', 'El lema es opcional');
select col_is_null('actividades', 'abreviatura', 'La abreviatura es opcional');
select col_is_null('configuracion', 'mantenimiento_foto_id', 'La foto de mantenimiento es opcional');

select is((select count(*)::int from actividades
           where lema is not null or cita_texto is not null or cita_referencia is not null or abreviatura is not null),
  0, 'El seed no inventa lemas, citas ni abreviaturas');
select is((select mantenimiento_foto_id from configuracion), null, 'El seed no fija foto de mantenimiento');

-- -----------------------------------------------------------------------------
-- Validaciones
-- -----------------------------------------------------------------------------
select lives_ok($$ update actividades set lema = 'Lema de prueba', cita_texto = 'Texto de prueba', cita_referencia = '1 Samuel 3:8', abreviatura = 'EMJ'
                   where slug = 'emj-2026' $$, 'Se guardan lema, cita y abreviatura válidos');
select throws_ok($$ update actividades set cita_texto = 'Texto', cita_referencia = null where slug = 'fedi-2026' $$,
  '23514', null, 'Una cita sin referencia no se acepta');
select throws_ok($$ update actividades set abreviatura = 'emj' where slug = 'fedi-2026' $$,
  '23514', null, 'La abreviatura va en mayúsculas');
select throws_ok($$ update actividades set abreviatura = 'E<script>' where slug = 'fedi-2026' $$,
  '23514', null, 'La abreviatura solo admite letras y números');
select throws_ok($$ update actividades set lema = '   ' where slug = 'fedi-2026' $$,
  '23514', null, 'El lema no puede quedar en blanco');

-- -----------------------------------------------------------------------------
-- Permisos: solo Eventos/Superadmin editan actividades; solo Superadmin la configuración
-- -----------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values ('c7000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mm@m7.prueba');
insert into perfil_roles (perfil_id, rol) select id, 'multimedia' from perfiles where correo = 'mm@m7.prueba';
insert into auth.sessions (id, user_id, aal, created_at, updated_at)
values ('c7000000-0000-4000-8000-0000000000aa', 'c7000000-0000-4000-8000-000000000001', 'aal1', now(), now());

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'c7000000-0000-4000-8000-000000000001', 'role', 'authenticated',
  'aal', 'aal1', 'session_id', 'c7000000-0000-4000-8000-0000000000aa')::text, true);
update actividades set lema = 'x' where slug = 'fedi-2026';
update configuracion set mantenimiento_foto_id = (select id from fotos limit 1);
reset role;
select is((select lema from actividades where slug = 'fedi-2026'), null, 'Multimedia no cambia el lema de una actividad');
select is((select mantenimiento_foto_id from configuracion), null, 'Multimedia no cambia la foto de mantenimiento');

-- -----------------------------------------------------------------------------
-- La foto de mantenimiento pasa a ser pública solo cuando se configura
-- -----------------------------------------------------------------------------
insert into fotos (id, archivo, texto_alternativo)
values ('c7000000-0000-4000-8000-0000000000f0', 'diseno/mantenimiento-prueba.jpg', 'Foto de prueba');
select ok(not foto_es_publica('c7000000-0000-4000-8000-0000000000f0'), 'Una foto sin uso no es pública');
update configuracion set mantenimiento_foto_id = 'c7000000-0000-4000-8000-0000000000f0';
select ok(foto_es_publica('c7000000-0000-4000-8000-0000000000f0'), 'La foto de mantenimiento configurada es pública');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from fotos where id = 'c7000000-0000-4000-8000-0000000000f0'), 1,
  'El visitante puede leer la foto de mantenimiento (para mostrarla)');
reset role;

select * from finish();
rollback;
