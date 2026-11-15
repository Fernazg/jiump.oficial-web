-- Pruebas de la migración 10 (panel /admin, etapa 3): páginas, menú y textos
-- institucionales con cambios pendientes y vista previa; usuarios_panel().
-- Ejecutar con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(40);

create function pg_temp.crear_usuario(p_id uuid, p_correo text, p_roles rol_app[], p_factor boolean default false)
returns void language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_correo, jsonb_build_object('nombre', split_part(p_correo, '@', 1)));
  if p_factor or 'superadmin' = any (p_roles) then
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

select is((select count(*)::int from perfil_roles where rol = 'superadmin'), 0, 'La base parte sin superadmins');
select pg_temp.crear_usuario('5a000000-0000-4000-8000-000000000001', 'supersitio@pgtap.prueba', '{superadmin}');
select pg_temp.crear_usuario('5a000000-0000-4000-8000-000000000002', 'editorsitio@pgtap.prueba', '{editor}');
select pg_temp.crear_usuario('5a000000-0000-4000-8000-000000000004', 'eventossitio@pgtap.prueba', '{eventos}', true);
select pg_temp.crear_usuario('5a000000-0000-4000-8000-000000000005', 'multisitio@pgtap.prueba', '{multimedia}');

-- Lo que un rol que no es Superadmin intenta en estas secciones; devuelve lo que logró.
create function pg_temp.intentos() returns text language plpgsql as $$
declare
  logrado text[] := '{}';
  n int;
begin
  begin perform guardar_contenido('pagina', (select id from paginas where clave = 'inicio'), 'epoch', '{}'); logrado := array_append(logrado, 'pagina'); exception when others then null; end;
  begin perform guardar_contenido('menu', '00000000-0000-0000-0000-000000000000', 'epoch', '{"items":[]}'); logrado := array_append(logrado, 'menu'); exception when others then null; end;
  begin perform guardar_contenido('institucional', '00000000-0000-0000-0000-000000000000', 'epoch', '{"items":[]}'); logrado := array_append(logrado, 'institucional'); exception when others then null; end;
  begin update paginas set estado = 'borrador' where clave = 'eventos'; get diagnostics n = row_count; if n > 0 then logrado := array_append(logrado, 'retirar'); end if; exception when others then null; end;
  begin update secciones set visible = false; get diagnostics n = row_count; if n > 0 then logrado := array_append(logrado, 'secciones'); end if; exception when others then null; end;
  begin update configuracion set modo_mantenimiento = true; get diagnostics n = row_count; if n > 0 then logrado := array_append(logrado, 'mantenimiento'); end if; exception when others then null; end;
  begin insert into redirecciones (origen, destino) values ('/intento', '/'); logrado := array_append(logrado, 'redireccion'); exception when others then null; end;
  begin insert into perfil_roles (perfil_id, rol) select id, 'superadmin' from perfiles where user_id = auth.uid(); logrado := array_append(logrado, 'rol'); exception when others then null; end;
  begin update perfiles set activo = false where user_id <> auth.uid(); get diagnostics n = row_count; if n > 0 then logrado := array_append(logrado, 'desactivar'); end if; exception when others then null; end;
  if (select count(*) from registro_actividad) > 0 then logrado := array_append(logrado, 'registro'); end if;
  if (select count(*) from usuarios_panel()) > 0 then logrado := array_append(logrado, 'usuarios'); end if;
  return array_to_string(logrado, ',');
end $$;
grant execute on function pg_temp.intentos() to authenticated;
-- Superadmin cuyo rol se asignó ANTES de su factor: no vigente
insert into auth.users (id, instance_id, aud, role, email) values
  ('5a000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tardio@pgtap.prueba');
insert into perfil_roles (perfil_id, rol) select id, 'superadmin' from perfiles where user_id = '5a000000-0000-4000-8000-000000000003';
insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
values (gen_random_uuid(), '5a000000-0000-4000-8000-000000000003', 'totp', 'verified', now() + interval '1 minute', now() + interval '1 minute');

-- -----------------------------------------------------------------------------
-- Al menos dos Superadministradores activos (migración 11)
-- Partir de cero e ir agregando nunca se bloquea; quitar el rol o desactivar
-- no puede dejar menos de dos activos. Cada intento se revierte si falla.
-- -----------------------------------------------------------------------------
create function pg_temp.intentar(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  set constraints all immediate;
  set constraints all deferred;
  return 'ok';
exception when check_violation then
  return sqlerrm;
end $$;
select pg_temp.crear_usuario('5a000000-0000-4000-8000-000000000006', 'auxsuper@pgtap.prueba', '{editor}', true);
select pg_temp.crear_usuario('5a000000-0000-4000-8000-000000000007', 'auxeditor@pgtap.prueba', '{editor}');

select is(pg_temp.intentar('select 1'), 'ok', 'Desde cero se asignaron el primero y el segundo sin bloqueo');
select is((select count(*)::int from perfil_roles pr join perfiles p on p.id = pr.perfil_id where pr.rol = 'superadmin' and p.activo), 2, 'Hay dos activos');
select is(pg_temp.intentar($$ delete from perfil_roles where rol = 'superadmin' and perfil_id = (select id from perfiles where correo = 'tardio@pgtap.prueba') $$),
  'Deben quedar al menos dos Superadministradores activos', 'Con dos, no se puede quitar el rol a uno');
select is(pg_temp.intentar($$ update perfiles set activo = false where correo = 'tardio@pgtap.prueba' $$),
  'Deben quedar al menos dos Superadministradores activos', 'Con dos, no se puede desactivar a uno');
select is(pg_temp.intentar($$ insert into perfil_roles (perfil_id, rol) select id, 'superadmin' from perfiles where correo = 'auxsuper@pgtap.prueba' $$), 'ok',
  'Se agrega un tercero');
select is(pg_temp.intentar($$ update perfiles set activo = false where correo = 'auxsuper@pgtap.prueba' $$), 'ok',
  'Con tres, se puede desactivar a uno (quedan dos)');
select is(pg_temp.intentar($$ delete from perfil_roles where rol = 'superadmin' and perfil_id = (select id from perfiles where correo = 'auxsuper@pgtap.prueba') $$), 'ok',
  'Quitar el rol a alguien ya desactivado no cuenta');
select is(pg_temp.intentar($$ update perfiles set activo = false where correo = 'auxeditor@pgtap.prueba' $$), 'ok',
  'Desactivar a quien no es superadmin no se bloquea');

update paginas set estado = 'publicado' where clave = 'inicio';
update paginas set estado = 'borrador' where clave = 'galeria';
update secciones set contenido = '{"titulo":"Título publicado"}'
where tipo = 'portada' and pagina_id = (select id from paginas where clave = 'inicio');

-- -----------------------------------------------------------------------------
-- Páginas: lo publicado no cambia hasta publicar los cambios
-- -----------------------------------------------------------------------------
select pg_temp.como('5a000000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$ update secciones set contenido = '{"titulo":"Directo"}' where tipo = 'portada' $$,
  'P0001', 'Está publicado: los cambios quedan pendientes hasta revisar la vista previa y publicarlos',
  'Las secciones de una página publicada no se cambian directo');
select throws_ok($$ update paginas set seo_titulo = 'Directo' where clave = 'inicio' $$, 'P0001', null,
  'Tampoco el SEO de una página publicada');
select lives_ok(format($$ select guardar_contenido('pagina', %L, %L,
  '{"seo_titulo":"SEO nuevo","secciones":[{"tipo":"portada","visible":true,"contenido":{"titulo":"Título nuevo"}},{"tipo":"presentacion","visible":false,"contenido":{}}]}') $$,
  (select id from paginas where clave = 'inicio'), (select actualizado_en from paginas where clave = 'inicio')),
  'Guardar una página publicada…');
select is((select contenido ->> 'titulo' from secciones s join paginas p on p.id = s.pagina_id where p.clave = 'inicio' and s.tipo = 'portada'), 'Título publicado',
  '…deja el sitio igual (cambio pendiente)');
select throws_ok(format($$ select publicar_cambios('pagina', %L) $$, (select id from paginas where clave = 'inicio')),
  'P0001', 'Antes de publicar hay que revisar la vista previa de este contenido', 'Publicar exige la vista previa');
insert into vistas_previas_contenido (tipo, registro_id, huella)
select 'pagina', id, huella_contenido('pagina', id) from paginas where clave = 'inicio';
select lives_ok(format($$ select publicar_cambios('pagina', %L) $$, (select id from paginas where clave = 'inicio')), 'Con vista previa, se publican');
select is((select string_agg(s.tipo || ':' || s.visible || ':' || coalesce(s.contenido ->> 'titulo', ''), ',' order by s.orden)
           from secciones s join paginas p on p.id = s.pagina_id where p.clave = 'inicio'),
  'portada:true:Título nuevo,presentacion:false:', 'Secciones, orden y visibilidad publicados');
select is((select seo_titulo from paginas where clave = 'inicio'), 'SEO nuevo', 'SEO publicado');
select is((select count(*)::int from secciones s join paginas p on p.id = s.pagina_id where p.clave = 'nosotros'), 6,
  'Nosotros nace con sus 6 secciones (solo estructura)');

-- Página en borrador: se guarda directo; publicarla exige vista previa
select lives_ok(format($$ select guardar_contenido('pagina', %L, %L, '{"secciones":[]}') $$,
  (select id from paginas where clave = 'galeria'), (select actualizado_en from paginas where clave = 'galeria')),
  'En borrador, guardar aplica directo');
select throws_ok($$ update paginas set estado = 'publicado' where clave = 'galeria' $$, 'P0001', null,
  'Publicar una página exige su vista previa');
insert into vistas_previas_contenido (tipo, registro_id, huella)
select 'pagina', id, huella_contenido('pagina', id) from paginas where clave = 'galeria';
select lives_ok($$ update paginas set estado = 'publicado' where clave = 'galeria' $$, 'Con vista previa, se publica');
select lives_ok(format($$ select despublicar_contenido('pagina', %L) $$, (select id from paginas where clave = 'galeria')), 'Y se puede retirar');

-- -----------------------------------------------------------------------------
-- Menú y pie
-- -----------------------------------------------------------------------------
select throws_ok($$ insert into menu (ubicacion, etiqueta, url) values ('pie', 'Directo', '/directo') $$, 'P0001', null,
  'El menú no se cambia directo');
select lives_ok($$ select guardar_contenido('menu', '00000000-0000-0000-0000-000000000000', 'epoch',
  '{"items":[{"ubicacion":"principal","etiqueta":"Eventos","url":"/eventos","visible":true},{"ubicacion":"pie","etiqueta":"Galería","url":"/galeria","visible":false}]}') $$,
  'Guardar el menú deja los cambios pendientes');
select is((select count(*)::int from menu where etiqueta = 'Nosotros'), 1, 'El menú del sitio no cambió todavía');
insert into vistas_previas_contenido (tipo, registro_id, huella)
values ('menu', '00000000-0000-0000-0000-000000000000', huella_contenido('menu', '00000000-0000-0000-0000-000000000000'));
select lives_ok($$ select publicar_cambios('menu', '00000000-0000-0000-0000-000000000000') $$, 'Con vista previa, el menú se publica');
select is((select string_agg(ubicacion || ':' || etiqueta || ':' || visible, ',' order by orden) from menu),
  'principal:Eventos:true,pie:Galería:false', 'Menú y pie publicados en su orden');

-- -----------------------------------------------------------------------------
-- Textos institucionales (se publican tal como se cargan)
-- -----------------------------------------------------------------------------
select throws_ok($$ insert into institucional (tipo, titulo) values ('vision', 'Directo') $$, 'P0001', null,
  'Los textos institucionales no se cambian directo');
select lives_ok($$ select guardar_contenido('institucional', '00000000-0000-0000-0000-000000000000', 'epoch',
  '{"items":[{"tipo":"cifra","titulo":"Valor de prueba","texto":"Descripción de prueba"}]}') $$, 'Guardar institucional queda pendiente');
insert into vistas_previas_contenido (tipo, registro_id, huella)
values ('institucional', '00000000-0000-0000-0000-000000000000', huella_contenido('institucional', '00000000-0000-0000-0000-000000000000'));
select lives_ok($$ select publicar_cambios('institucional', '00000000-0000-0000-0000-000000000000') $$, 'Con vista previa, se publica');
select is((select string_agg(tipo || ':' || titulo || ':' || estado, ',') from institucional), 'cifra:Valor de prueba:publicado',
  'Quedan publicados');

-- -----------------------------------------------------------------------------
-- Usuarios y roles
-- -----------------------------------------------------------------------------
select is((select doble_factor::text || superadmin_vigente::text from usuarios_panel() where correo = 'supersitio@pgtap.prueba'), 'truetrue',
  'usuarios_panel(): superadmin con doble factor previo al rol');
select is((select doble_factor::text || superadmin_vigente::text from usuarios_panel() where correo = 'tardio@pgtap.prueba'), 'truefalse',
  'Un superadmin cuyo factor es posterior al rol no está vigente');

select pg_temp.como('5a000000-0000-4000-8000-000000000004', 'aal2');
select is(pg_temp.intentos(), '', 'Eventos (con doble factor) no edita páginas, menú, institucional, usuarios, registro ni configuración');
reset role;
select pg_temp.como('5a000000-0000-4000-8000-000000000005');
select is(pg_temp.intentos(), '', 'Multimedia tampoco');
reset role;
select pg_temp.como('5a000000-0000-4000-8000-000000000002');
select is(pg_temp.intentos(), '', 'Editor tampoco');
select is((select count(*)::int from usuarios_panel()), 0, 'Editor no ve la lista de usuarios');
select throws_ok($$ select guardar_contenido('menu', '00000000-0000-0000-0000-000000000000', 'epoch', '{"items":[]}') $$,
  '42501', null, 'Editor no edita el menú');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select * from usuarios_panel() $$, '42501', null, 'El visitante no consulta usuarios');
reset role;

-- Control: el Superadmin sí logra esas acciones (la prueba de arriba no pasa «en vacío»).
select pg_temp.como('5a000000-0000-4000-8000-000000000001', 'aal2');
select matches(pg_temp.intentos(), 'menu,institucional.*mantenimiento,redireccion.*registro,usuarios', 'El Superadmin sí puede (control de la prueba)');
reset role;

select * from finish();
rollback;
