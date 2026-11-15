-- Pruebas de la migración 10 (panel /admin, etapa 3): páginas, menú y textos
-- institucionales con cambios pendientes y vista previa; usuarios_panel().
-- Ejecutar con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(26);

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

select pg_temp.crear_usuario('5a000000-0000-4000-8000-000000000001', 'supersitio@pgtap.prueba', '{superadmin}');
select pg_temp.crear_usuario('5a000000-0000-4000-8000-000000000002', 'editorsitio@pgtap.prueba', '{editor}');
-- Superadmin cuyo rol se asignó ANTES de su factor: no vigente
insert into auth.users (id, instance_id, aud, role, email) values
  ('5a000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tardio@pgtap.prueba');
insert into perfil_roles (perfil_id, rol) select id, 'superadmin' from perfiles where user_id = '5a000000-0000-4000-8000-000000000003';
insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
values (gen_random_uuid(), '5a000000-0000-4000-8000-000000000003', 'totp', 'verified', now() + interval '1 minute', now() + interval '1 minute');

update paginas set estado = 'publicado' where clave = 'inicio';
update paginas set estado = 'borrador' where clave = 'galeria';
insert into secciones (pagina_id, tipo, contenido, orden)
select id, 'portada', '{"titulo":"Título publicado"}', 1 from paginas where clave = 'inicio';

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
select is((select contenido ->> 'titulo' from secciones s join paginas p on p.id = s.pagina_id where p.clave = 'inicio'), 'Título publicado',
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

select pg_temp.como('5a000000-0000-4000-8000-000000000002');
select is((select count(*)::int from usuarios_panel()), 0, 'Editor no ve la lista de usuarios');
select throws_ok($$ select guardar_contenido('menu', '00000000-0000-0000-0000-000000000000', 'epoch', '{"items":[]}') $$,
  '42501', null, 'Editor no edita el menú');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select * from usuarios_panel() $$, '42501', null, 'El visitante no consulta usuarios');
reset role;

select * from finish();
rollback;
