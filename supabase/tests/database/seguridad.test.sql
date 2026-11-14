-- =============================================================================
-- Revisión de seguridad del backend (pensada como atacante).
-- Ejecutar con: supabase test db
--
-- Cada bloque corresponde a un punto de la revisión:
--   1. Visitante anónimo: nada que no esté publicado
--   2. Matriz de roles exacta (ni más ni menos), incluida una persona con dos roles
--   3. Nadie se asigna roles ni se da permisos editando su perfil
--   4. Funciones SECURITY DEFINER y privilegios por defecto
--   5. Triggers y vistas: sin filtraciones ni escrituras por caminos sin RLS
--   6. Bucket «fotos»: subir, sobrescribir, mover, borrar y listar
--   7. Doble factor del superadmin (aal2) ligado a un factor anterior al rol
--   8. Usuario desactivado o sesión cerrada: sin acceso inmediato
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select * from no_plan();

-- -----------------------------------------------------------------------------
-- Usuarios ficticios (solo existen dentro de esta transacción)
-- -----------------------------------------------------------------------------
create temp table actores (clave text primary key, uid uuid, aal text, factor uuid, con_sesion boolean, rol_bd text);

create function pg_temp.crear_usuario(p_id uuid, p_roles rol_app[], p_factor uuid default null, p_factor_creado timestamptz default null)
returns void language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_id || '@seguridad.prueba');
  if p_factor is not null then
    insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
    values (p_factor, p_id, 'totp ' || p_factor, 'totp', 'verified', p_factor_creado, p_factor_creado);
  end if;
  insert into perfil_roles (perfil_id, rol)
  select p.id, r from perfiles p, unnest(p_roles) r where p.user_id = p_id;
end $$;

-- Superadmin con factor inscrito ANTES de recibir el rol (flujo correcto).
select pg_temp.crear_usuario('a1000000-0000-4000-8000-000000000001', '{superadmin}', 'f1000000-0000-4000-8000-000000000001', now() - interval '1 day');
-- Superadmin cuyo único factor se inscribió DESPUÉS de recibir el rol
-- (lo que haría quien robe la contraseña de alguien que aún no tenía 2FA).
select pg_temp.crear_usuario('a2000000-0000-4000-8000-000000000002', '{superadmin}', 'f2000000-0000-4000-8000-000000000002', now() + interval '1 minute');
select pg_temp.crear_usuario('b1000000-0000-4000-8000-000000000001', '{editor}');
select pg_temp.crear_usuario('b2000000-0000-4000-8000-000000000002', '{eventos}');
select pg_temp.crear_usuario('b3000000-0000-4000-8000-000000000003', '{multimedia}');
select pg_temp.crear_usuario('b4000000-0000-4000-8000-000000000004', '{eventos,multimedia}');
select pg_temp.crear_usuario('b5000000-0000-4000-8000-000000000005', '{editor}');
select pg_temp.crear_usuario('b6000000-0000-4000-8000-000000000006', '{}');
select pg_temp.crear_usuario('b8000000-0000-4000-8000-000000000008', '{editor}');
update perfiles set activo = false where user_id = 'b5000000-0000-4000-8000-000000000005';

insert into actores values
  ('superadmin',              'a1000000-0000-4000-8000-000000000001', 'aal2', 'f1000000-0000-4000-8000-000000000001', true,  'authenticated'),
  ('superadmin_sin_2fa',      'a1000000-0000-4000-8000-000000000001', 'aal1', null,                                    true,  'authenticated'),
  ('superadmin_factor_nuevo', 'a2000000-0000-4000-8000-000000000002', 'aal2', 'f2000000-0000-4000-8000-000000000002', true,  'authenticated'),
  ('editor',                  'b1000000-0000-4000-8000-000000000001', 'aal1', null, true,  'authenticated'),
  ('eventos',                 'b2000000-0000-4000-8000-000000000002', 'aal1', null, true,  'authenticated'),
  ('multimedia',              'b3000000-0000-4000-8000-000000000003', 'aal1', null, true,  'authenticated'),
  ('eventos_multimedia',      'b4000000-0000-4000-8000-000000000004', 'aal1', null, true,  'authenticated'),
  ('inactivo',                'b5000000-0000-4000-8000-000000000005', 'aal1', null, true,  'authenticated'),
  ('sin_rol',                 'b6000000-0000-4000-8000-000000000006', 'aal1', null, true,  'authenticated'),
  ('editor_sesion_cerrada',   'b1000000-0000-4000-8000-000000000001', 'aal1', null, false, 'authenticated'),
  ('anon',                    null,                                   null,   null, false, 'anon');

-- Simula un token de acceso del actor: crea (o no) su sesión en auth.sessions,
-- fija los claims del JWT y cambia al rol de base de datos que usa la API.
create function pg_temp.como(p_actor text) returns void language plpgsql as $$
declare
  a actores;
  sesion uuid := gen_random_uuid();
begin
  select * into a from actores where clave = p_actor;
  if not found then raise exception 'actor desconocido: %', p_actor; end if;
  if a.con_sesion then
    insert into auth.sessions (id, user_id, aal, factor_id, created_at, updated_at)
    values (sesion, a.uid, a.aal::auth.aal_level, a.factor, now(), now());
  end if;
  if a.uid is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  else
    perform set_config('request.jwt.claims', json_build_object(
      'sub', a.uid, 'role', 'authenticated', 'aal', a.aal, 'session_id', sesion)::text, true);
  end if;
  perform set_config('role', a.rol_bd, true);
end $$;

-- Ejecuta una sentencia como el actor y deshace todo. Devuelve 'ok:<filas>'
-- o el SQLSTATE del error.
create function pg_temp.resultado(p_actor text, p_sql text) returns text language plpgsql as $$
declare
  n int;
begin
  begin
    perform pg_temp.como(p_actor);
    execute p_sql;
    get diagnostics n = row_count;
    raise exception using errcode = 'XX999', message = n::text;
  exception
    when sqlstate 'XX999' then return 'ok:' || sqlerrm;
    when others then return sqlstate;
  end;
end $$;

-- ¿Logra el actor su objetivo? (la sentencia corre sin error y afecta o devuelve filas)
create function pg_temp.puede(p_actor text, p_sql text) returns boolean language sql as $$
  select coalesce(substr(r, 1, 3) = 'ok:' and substr(r, 4)::int > 0, false)
  from pg_temp.resultado(p_actor, p_sql) r;
$$;

-- -----------------------------------------------------------------------------
-- Contenido NO publicado para intentar leer (creado como administrador)
-- -----------------------------------------------------------------------------
insert into fotos (id, archivo, texto_alternativo, creado_por) values
  ('fa000000-0000-4000-8000-00000000000a', 'b6000000-0000-4000-8000-000000000006/ajena.jpg', 'Foto ajena', 'b6000000-0000-4000-8000-000000000006'),
  ('fb000000-0000-4000-8000-00000000000b', 'b6000000-0000-4000-8000-000000000006/actividad-borrador.jpg', 'Solo en actividad en borrador', null),
  ('fc000000-0000-4000-8000-00000000000c', 'b6000000-0000-4000-8000-000000000006/album-borrador.jpg', 'Solo en álbum en borrador', null),
  ('fd000000-0000-4000-8000-00000000000d', 'b6000000-0000-4000-8000-000000000006/cuerpo-borrador.jpg', 'Solo en el cuerpo de un borrador', null),
  ('fe000000-0000-4000-8000-00000000000e', 'b6000000-0000-4000-8000-000000000006/programado.jpg', 'Portada de un programado futuro', null);

insert into series (id, nombre, slug) values ('5e000000-0000-4000-8000-000000000001', 'Serie planificada', 'serie-planificada');
insert into temas (id, nombre, slug) values ('7e000000-0000-4000-8000-000000000001', 'Tema planificado', 'tema-planificado');

insert into articulos (id, titulo, slug, serie_id, parte, estado, publicar_en, portada_foto_id, cuerpo) values
  ('e1000000-0000-4000-8000-000000000001', 'Borrador secreto', 'borrador-secreto', '5e000000-0000-4000-8000-000000000001', 1, 'borrador', null, null,
   '[{"tipo":"parrafo","texto":"palabraborrador"},{"tipo":"imagen","foto_id":"fd000000-0000-4000-8000-00000000000d"}]'),
  ('e2000000-0000-4000-8000-000000000002', 'En revisión secreto', 'revision-secreto', null, null, 'revision', null, null, '[]'),
  ('e3000000-0000-4000-8000-000000000003', 'Programado secreto', 'programado-secreto', null, null, 'programado', now() + interval '2 days',
   'fe000000-0000-4000-8000-00000000000e', '[]'),
  ('e4000000-0000-4000-8000-000000000004', 'Publicado y luego borrado', 'en-papelera', null, null, 'publicado', null, null, '[]');
update articulos set titulo = 'Papelera secreta', estado = 'papelera' where id = 'e4000000-0000-4000-8000-000000000004';
insert into articulo_temas values ('e1000000-0000-4000-8000-000000000001', '7e000000-0000-4000-8000-000000000001');

insert into actividades (id, titulo, slug, tipo, anio, estado) values
  ('e5000000-0000-4000-8000-000000000005', 'Actividad secreta', 'actividad-secreta', 'zonal', 2027, 'borrador');
insert into actividad_secciones (actividad_id, titulo) values ('e5000000-0000-4000-8000-000000000005', 'Día 1 secreto');
insert into actividad_enlaces (actividad_id, titulo, url) values ('e5000000-0000-4000-8000-000000000005', 'Enlace secreto', 'https://www.youtube.com/watch?v=secreto');
insert into actividad_fotos (actividad_id, foto_id) values ('e5000000-0000-4000-8000-000000000005', 'fb000000-0000-4000-8000-00000000000b');

insert into albumes (id, titulo, slug, estado) values ('e6000000-0000-4000-8000-000000000006', 'Álbum secreto', 'album-secreto', 'borrador');
insert into album_fotos (album_id, foto_id) values ('e6000000-0000-4000-8000-000000000006', 'fc000000-0000-4000-8000-00000000000c');
insert into videos (titulo, url, estado) values ('Video secreto', 'https://youtu.be/secreto', 'borrador');

update paginas set estado = 'publicado' where clave = 'eventos';
insert into secciones (pagina_id, tipo, visible) select id, 'oculta', false from paginas where clave = 'eventos';
insert into secciones (pagina_id, tipo, visible) select id, 'de_borrador', true from paginas where clave = 'inicio';
insert into institucional (tipo, titulo, texto, estado) values ('vision', 'Visión', 'Texto aún no aprobado', 'borrador');
insert into menu (ubicacion, etiqueta, url, visible) values ('pie', 'Oculto', '/oculto', false);

-- Objetos de Storage: uno propio por actor, la foto ajena y una foto publicada del seed.
set local storage.allow_delete_query = 'true';  -- para probar las políticas de borrado
insert into storage.objects (bucket_id, name, owner_id)
select 'fotos', a.uid || '/propia.jpg', a.uid::text from (select distinct uid from actores where uid is not null) a;
insert into storage.objects (bucket_id, name, owner_id) values
  ('fotos', 'b6000000-0000-4000-8000-000000000006/ajena.jpg', 'b6000000-0000-4000-8000-000000000006'),
  ('fotos', 'b6000000-0000-4000-8000-000000000006/actividad-borrador.jpg', 'b6000000-0000-4000-8000-000000000006'),
  ('fotos', 'diseno/784625ac3ebfe474ed6261cca016b8df.jpg', null);

-- =============================================================================
-- 1. Visitante anónimo: nada que no esté publicado
-- =============================================================================
select is(pg_temp.resultado('anon', $$ select 1 from articulos where id in ('e1000000-0000-4000-8000-000000000001',
  'e2000000-0000-4000-8000-000000000002', 'e3000000-0000-4000-8000-000000000003', 'e4000000-0000-4000-8000-000000000004') $$),
  'ok:0', '1 · Anónimo no lee borradores, «en revisión», programados antes de su fecha ni la papelera');
select is(pg_temp.resultado('anon', $$ select 1 from articulo_versiones $$), '42501', '1 · Anónimo no lee versiones de artículos');
select is(pg_temp.resultado('anon', $$ select 1 from registro_actividad $$), '42501', '1 · Anónimo no lee el registro de actividad');
select is(pg_temp.resultado('anon', $$ select correo from perfiles $$), '42501', '1 · Anónimo no lee perfiles ni correos');
select is(pg_temp.resultado('anon', $$ select 1 from perfil_roles $$), '42501', '1 · Anónimo no lee roles');
select is(pg_temp.resultado('anon', $$ select 1 from mis_roles() $$), '42501', '1 · Anónimo no puede llamar a mis_roles()');
select is(pg_temp.resultado('anon', $$ select 1 from articulo_temas where articulo_id = 'e1000000-0000-4000-8000-000000000001' $$), 'ok:0',
  '1 · Anónimo no ve los temas de un borrador');
select is(pg_temp.resultado('anon', $$ select 1 from actividades where id = 'e5000000-0000-4000-8000-000000000005'
  union all select 1 from actividad_secciones where actividad_id = 'e5000000-0000-4000-8000-000000000005'
  union all select 1 from actividad_enlaces where actividad_id = 'e5000000-0000-4000-8000-000000000005'
  union all select 1 from actividad_fotos where actividad_id = 'e5000000-0000-4000-8000-000000000005' $$), 'ok:0',
  '1 · Anónimo no ve una actividad en borrador ni sus secciones, enlaces o fotos');
select is(pg_temp.resultado('anon', $$ select 1 from albumes where id = 'e6000000-0000-4000-8000-000000000006'
  union all select 1 from album_fotos where album_id = 'e6000000-0000-4000-8000-000000000006'
  union all select 1 from videos where estado <> 'publicado' $$), 'ok:0',
  '1 · Anónimo no ve álbumes ni videos en borrador');
select is(pg_temp.resultado('anon', $$ select 1 from paginas where estado <> 'publicado'
  union all select 1 from secciones where tipo in ('oculta', 'de_borrador') $$), 'ok:0',
  '1 · Anónimo no ve páginas en borrador ni secciones ocultas');
select is(pg_temp.resultado('anon', $$ select 1 from institucional where estado <> 'publicado'
  union all select 1 from menu where not visible $$), 'ok:0',
  '1 · Anónimo no ve textos institucionales en borrador ni enlaces ocultos del menú');
select is(pg_temp.resultado('anon', $$ select 1 from fotos where id in ('fa000000-0000-4000-8000-00000000000a',
  'fb000000-0000-4000-8000-00000000000b', 'fc000000-0000-4000-8000-00000000000c', 'fd000000-0000-4000-8000-00000000000d',
  'fe000000-0000-4000-8000-00000000000e') $$), 'ok:0',
  '1 · Anónimo no ve fotos usadas solo en contenido no publicado');
select is(pg_temp.resultado('anon', $$ select 1 from buscar_articulos('palabraborrador') $$), 'ok:0',
  '1 · La búsqueda no devuelve texto de borradores');
select is(pg_temp.resultado('anon', $$ select 1 from storage.objects where name like 'b6000000-0000-4000-8000-000000000006/%' $$), 'ok:0',
  '1 · Anónimo no lista archivos de fotos no publicadas');
-- Hallazgo: con el bucket público, cualquiera con la URL descargaba fotos no
-- publicadas (o que se despublicaron); la URL además queda en cachés.
select is((select public from storage.buckets where id = 'fotos'), false,
  '1 · HALLAZGO · El bucket «fotos» no es público: la URL de una foto no publicada no sirve');
-- Hallazgo: series y temas sin artículos publicados revelaban contenido planificado.
select is(pg_temp.resultado('anon', $$ select 1 from series where slug = 'serie-planificada'
  union all select 1 from temas where slug = 'tema-planificado' $$), 'ok:0',
  '1 · HALLAZGO · Anónimo no ve series ni temas que solo tienen artículos sin publicar');
select ok(pg_temp.puede('anon', $$ select 1 from series where slug = 'mes-de-la-biblia' $$),
  '1 · Anónimo sí ve las series con artículos publicados');

-- =============================================================================
-- 2, 7 y 8. Matriz de permisos: quién puede ESCRIBIR en cada sección
-- (docs/roles-permisos.md). Incluye superadmin sin 2FA, superadmin con un
-- factor inscrito después del rol, usuario desactivado, sin rol y sesión cerrada.
-- =============================================================================
create temp table acciones (seccion text, sql text, permitidos text[]);
insert into acciones values
  ('crear artículo', $$ insert into articulos (titulo, slug) values ('m', 'matriz') $$, '{superadmin,editor}'),
  ('crear serie', $$ insert into series (nombre, slug) values ('m', 'matriz') $$, '{superadmin,editor}'),
  ('crear tema', $$ insert into temas (nombre, slug) values ('m', 'matriz') $$, '{superadmin,editor}'),
  ('asignar tema', $$ insert into articulo_temas select 'e2000000-0000-4000-8000-000000000002', id from temas where slug = 'oracion' $$, '{superadmin,editor}'),
  ('crear actividad', $$ insert into actividades (titulo, slug, tipo, anio) values ('m', 'matriz', 'zonal', 2026) $$, '{superadmin,eventos,eventos_multimedia}'),
  ('destacar actividad en Inicio', $$ update actividades set destacar_inicio = not destacar_inicio where slug = 'convencion-nacional-2026' $$, '{superadmin,eventos,eventos_multimedia}'),
  ('sección de actividad', $$ insert into actividad_secciones (actividad_id, titulo) values ('c0000000-0000-4000-8000-000000000001', 'm') $$, '{superadmin,eventos,eventos_multimedia}'),
  ('enlace de actividad', $$ insert into actividad_enlaces (actividad_id, titulo, url) values ('c0000000-0000-4000-8000-000000000001', 'm', 'https://x.cl') $$, '{superadmin,eventos,eventos_multimedia}'),
  ('foto de actividad', $$ insert into actividad_fotos (actividad_id, foto_id) values ('c0000000-0000-4000-8000-000000000001', 'fa000000-0000-4000-8000-00000000000a') $$, '{superadmin,eventos,eventos_multimedia}'),
  ('subir foto', $$ insert into fotos (archivo, texto_alternativo) values (auth.uid() || '/matriz.jpg', 'm') $$, '{superadmin,editor,eventos,multimedia,eventos_multimedia}'),
  ('editar foto ajena', $$ update fotos set credito = 'm' where id = 'fa000000-0000-4000-8000-00000000000a' $$, '{superadmin,multimedia,eventos_multimedia}'),
  ('borrar foto ajena', $$ delete from fotos where id = 'fa000000-0000-4000-8000-00000000000a' $$, '{superadmin,multimedia,eventos_multimedia}'),
  ('crear álbum', $$ insert into albumes (titulo, slug) values ('m', 'matriz') $$, '{superadmin,multimedia,eventos_multimedia}'),
  ('foto de álbum', $$ insert into album_fotos (album_id, foto_id) values ('d0000000-0000-4000-8000-000000000001', 'fa000000-0000-4000-8000-00000000000a') $$, '{superadmin,multimedia,eventos_multimedia}'),
  ('crear video', $$ insert into videos (titulo, url) values ('m', 'https://youtu.be/m') $$, '{superadmin,multimedia,eventos_multimedia}'),
  ('editar página', $$ update paginas set titulo = titulo where clave = 'eventos' $$, '{superadmin}'),
  ('sección de página', $$ insert into secciones (pagina_id, tipo) select id, 'm' from paginas where clave = 'eventos' $$, '{superadmin}'),
  ('institucional', $$ insert into institucional (tipo, titulo) values ('vision', 'm') $$, '{superadmin}'),
  ('menú', $$ insert into menu (ubicacion, etiqueta, url) values ('pie', 'm', '/m') $$, '{superadmin}'),
  ('redirección', $$ insert into redirecciones (origen, destino) values ('/m', '/n') $$, '{superadmin}'),
  ('modo mantenimiento', $$ update configuracion set modo_mantenimiento = not modo_mantenimiento $$, '{superadmin}'),
  ('editar perfil ajeno', $$ update perfiles set nombre = 'm' where user_id = 'b8000000-0000-4000-8000-000000000008' $$, '{superadmin}'),
  ('asignar rol', $$ insert into perfil_roles (perfil_id, rol) select id, 'editor' from perfiles where user_id = 'b6000000-0000-4000-8000-000000000006' $$, '{superadmin}');

select is(pg_temp.puede(a.clave, x.sql), a.clave = any (x.permitidos),
          format('2 · %s → %s: %s', a.clave, x.seccion, case when a.clave = any (x.permitidos) then 'puede' else 'no puede' end))
from actores a cross join acciones x
order by x.seccion, a.clave;

-- ...y quién puede LEER contenido no publicado o interno
create temp table lecturas (seccion text, sql text, permitidos text[]);
insert into lecturas values
  ('artículo en borrador', $$ select 1 from articulos where id = 'e1000000-0000-4000-8000-000000000001' $$, '{superadmin,editor}'),
  ('versiones de artículos', $$ select 1 from articulo_versiones $$, '{superadmin,editor}'),
  ('actividad en borrador', $$ select 1 from actividades where id = 'e5000000-0000-4000-8000-000000000005' $$, '{superadmin,eventos,eventos_multimedia}'),
  ('fotos de actividad en borrador', $$ select 1 from actividad_fotos where actividad_id = 'e5000000-0000-4000-8000-000000000005' $$, '{superadmin,eventos,eventos_multimedia}'),
  ('álbum en borrador', $$ select 1 from albumes where id = 'e6000000-0000-4000-8000-000000000006' $$, '{superadmin,multimedia,eventos_multimedia}'),
  ('video en borrador', $$ select 1 from videos where estado = 'borrador' $$, '{superadmin,multimedia,eventos_multimedia}'),
  ('página en borrador', $$ select 1 from paginas where clave = 'inicio' $$, '{superadmin}'),
  ('institucional en borrador', $$ select 1 from institucional where estado = 'borrador' $$, '{superadmin}'),
  ('registro de actividad', $$ select 1 from registro_actividad $$, '{superadmin}'),
  ('perfil y correo de otra persona', $$ select correo from perfiles where user_id = 'b8000000-0000-4000-8000-000000000008' $$, '{superadmin}'),
  ('roles de otra persona', $$ select 1 from perfil_roles pr join perfiles p on p.id = pr.perfil_id where p.user_id = 'b8000000-0000-4000-8000-000000000008' $$, '{superadmin}');

select is(pg_temp.puede(a.clave, x.sql), a.clave = any (x.permitidos),
          format('2 · %s → leer %s: %s', a.clave, x.seccion, case when a.clave = any (x.permitidos) then 'puede' else 'no puede' end))
from actores a cross join lecturas x
order by x.seccion, a.clave;

-- =============================================================================
-- 3. Nadie se asigna roles ni se da permisos editando su propio perfil
-- =============================================================================
select ok(not pg_temp.puede('editor', $$ insert into perfil_roles (perfil_id, rol) select id, 'superadmin' from perfiles where user_id = auth.uid() $$),
  '3 · Editor no se asigna el rol de superadmin');
select ok(not pg_temp.puede('editor', $$ insert into perfil_roles (perfil_id, rol) select id, 'eventos' from perfiles where user_id = auth.uid() $$),
  '3 · Editor no se suma otro rol');
select ok(not pg_temp.puede('editor', $$ update perfil_roles set rol = 'superadmin' where perfil_id in (select id from perfiles where user_id = auth.uid()) $$),
  '3 · Editor no cambia su rol por otro');
select ok(not pg_temp.puede('editor', $$ update perfiles set nombre = 'x', activo = true where user_id = auth.uid() $$),
  '3 · Editor no edita su propio perfil');
select ok(not pg_temp.puede('editor', $$ insert into perfiles (user_id, correo) values (auth.uid(), 'otro@x.cl') $$),
  '3 · Editor no crea un segundo perfil para sí');
select ok(not pg_temp.puede('inactivo', $$ update perfiles set activo = true where user_id = auth.uid() $$),
  '3 · Un usuario desactivado no se reactiva');
select ok(not pg_temp.puede('superadmin_sin_2fa', $$ insert into perfil_roles (perfil_id, rol) select id, 'editor' from perfiles where user_id = auth.uid() $$),
  '3 · Superadmin sin doble factor no se asigna roles');
select ok(not pg_temp.puede('sin_rol', $$ update perfiles set user_id = auth.uid() where user_id = 'b1000000-0000-4000-8000-000000000001' $$),
  '3 · Nadie se apropia del perfil (y los roles) de otra persona');
-- Hallazgo: los roles se podían EDITAR (no solo crear y quitar); al cambiar
-- creado_en se falseaba la fecha que usa la regla del doble factor.
select ok(not pg_temp.puede('superadmin', $$ update perfil_roles set creado_en = now() - interval '10 years' $$),
  '3 · HALLAZGO · Las asignaciones de rol no se editan (solo se crean o se quitan)');
select is(pg_temp.resultado('editor', $$ select 1 from fotos where creado_por = auth.uid() $$), 'ok:0', '3 · (control) el editor aún no tiene fotos');
select is(pg_temp.resultado('editor', $$ with f as (insert into fotos (archivo, texto_alternativo, creado_por)
    values (auth.uid() || '/suplanta.jpg', 'x', 'b6000000-0000-4000-8000-000000000006') returning creado_por)
  select 1 from f where creado_por = auth.uid() $$), 'ok:1',
  '3 · creado_por lo fija el servidor: no se puede atribuir una foto a otra persona');

-- =============================================================================
-- 4. Funciones SECURITY DEFINER y privilegios
-- =============================================================================
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosecdef
             and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c = 'search_path=""')),
  0, '4 · Toda función SECURITY DEFINER fija search_path vacío');
select set_eq(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') $$,
  array['articulo_es_visible', 'buscar_articulos', 'es_equipo', 'es_slug_valido', 'foto_es_publica',
        'objeto_foto_es_publico', 'sin_tildes', 'texto_de_bloques', 'tiene_algun_rol', 'tiene_rol'],
  '4 · Anónimo solo ejecuta las funciones que necesitan las políticas y la búsqueda');
select is((select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'execute')
             and p.proname not in ('es_equipo', 'tiene_rol', 'tiene_algun_rol', 'mis_roles', 'foto_es_publica', 'objeto_foto_es_publico')),
  null, '4 · Ninguna otra función SECURITY DEFINER (triggers, purga) es ejecutable desde la API');
select ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                      where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  '4 · Todas las tablas públicas tienen RLS activado');
select ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                      where n.nspname = 'public' and c.relkind = 'r'
                        and (has_table_privilege('anon', c.oid, 'insert') or has_table_privilege('anon', c.oid, 'update')
                             or has_table_privilege('anon', c.oid, 'delete') or has_table_privilege('anon', c.oid, 'truncate'))),
  '4 · Anónimo no tiene privilegio de escritura en ninguna tabla');
select is(pg_temp.resultado('editor', $$ select purgar_papelera_articulos() $$), '42501', '4 · La API no puede vaciar la papelera');
select is(pg_temp.resultado('sin_rol', $$ select tiene_rol('superadmin') $$), 'ok:1', '4 · tiene_rol() solo responde por el usuario de la sesión');
select is((select tiene_rol('superadmin')), false, '4 · (control) sin sesión no hay roles');
-- Hallazgo: los privilegios por defecto de Supabase daban EXECUTE y escritura
-- al rol anónimo sobre toda función o tabla creada en migraciones futuras.
create function public.zz_prueba_privilegios() returns int language sql as 'select 1';
create table public.zz_prueba_privilegios (id int);
select ok(not has_function_privilege('anon', 'public.zz_prueba_privilegios()', 'execute'),
  '4 · HALLAZGO · Una función nueva no queda ejecutable por el visitante anónimo');
select ok(not has_table_privilege('anon', 'public.zz_prueba_privilegios', 'insert'),
  '4 · HALLAZGO · Una tabla nueva no queda escribible por el visitante anónimo');
drop function public.zz_prueba_privilegios();
drop table public.zz_prueba_privilegios;

-- =============================================================================
-- 5. Triggers y vistas
-- =============================================================================
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('v', 'm')
             and not coalesce('security_invoker=true' = any (c.reloptions), false)),
  0, '5 · No hay vistas que se salten RLS (sin security_invoker)');
select is(pg_temp.resultado('editor', $$ insert into articulo_versiones (articulo_id, titulo, cuerpo, estado)
  values ('e1000000-0000-4000-8000-000000000001', 'x', '[]', 'borrador') $$), '42501',
  '5 · Las versiones solo las escribe el trigger');
select is(pg_temp.resultado('superadmin', $$ delete from registro_actividad $$), '42501',
  '5 · Ni el superadmin puede borrar el registro de actividad');
select is(pg_temp.resultado('superadmin', $$ update registro_actividad set accion = 'editar' $$), '42501',
  '5 · Ni el superadmin puede alterar el registro de actividad');
select ok(not pg_temp.puede('eventos', $$ update articulos set titulo = 'x' where id = 'e2000000-0000-4000-8000-000000000002' $$),
  '5 · El trigger de versiones no abre un camino para editar artículos ajenos a tu rol');
-- Hallazgo: fotos.archivo no se validaba. Se podía registrar una foto que
-- apuntara al archivo de otra persona o usar comodines de LIKE («%», «_»)
-- para que objeto_foto_es_publico() diera por publicado cualquier archivo.
select is(pg_temp.resultado('editor', $$ insert into fotos (archivo, texto_alternativo)
  values ('b6000000-0000-4000-8000-000000000006/ajena.jpg', 'x') $$), '42501',
  '5 · HALLAZGO · No se registra una foto que apunta a la carpeta de otra persona');
select isnt(pg_temp.resultado('superadmin', $$ insert into fotos (archivo, texto_alternativo) values (auth.uid() || '/%', 'x') $$), 'ok:1',
  '5 · HALLAZGO · La ruta de una foto no admite comodines ni formatos raros');
insert into fotos (archivo, texto_alternativo, creado_por) values ('b1000000-0000-4000-8000-000000000001/propia-meta.jpg', 'x', 'b1000000-0000-4000-8000-000000000001');
select is(pg_temp.resultado('editor', $$ update fotos set archivo = 'b1000000-0000-4000-8000-000000000001/otra-ruta.jpg'
  where archivo = 'b1000000-0000-4000-8000-000000000001/propia-meta.jpg' $$), '23514',
  '5 · HALLAZGO · No se cambia el archivo de una foto ya registrada (para cambiar la foto se sube una nueva)');
select ok(objeto_foto_es_publico('diseno/784625ac3ebfe474ed6261cca016b8df/800.webp'),
  '5 · Las versiones optimizadas de una foto publicada son públicas');
select ok(not objeto_foto_es_publico('diseno/784625ac3ebfe474ed6261cca016b8df.jpg.bak'),
  '5 · Un nombre parecido al de una foto publicada no es público');

-- =============================================================================
-- 6. Bucket «fotos»: subir, sobrescribir (upsert), mover, borrar y listar
-- =============================================================================
create temp table acciones_storage (accion text, sql text, permitidos text[]);
insert into acciones_storage values
  ('subir a su carpeta', $$ insert into storage.objects (bucket_id, name, owner_id) values ('fotos', auth.uid() || '/nueva.jpg', auth.uid()) $$,
   '{superadmin,editor,eventos,multimedia,eventos_multimedia}'),
  ('subir a carpeta ajena', $$ insert into storage.objects (bucket_id, name, owner_id) values ('fotos', 'b6000000-0000-4000-8000-000000000006/nueva.jpg', auth.uid()) $$,
   '{}'),
  ('subir fuera de carpeta', $$ insert into storage.objects (bucket_id, name, owner_id) values ('fotos', 'suelta.jpg', auth.uid()) $$,
   '{}'),
  ('sobrescribir la propia (upsert)', $$ update storage.objects set metadata = '{"m":1}' where name = auth.uid() || '/propia.jpg' $$,
   '{superadmin,editor,eventos,multimedia,eventos_multimedia}'),
  ('sobrescribir ajena (upsert)', $$ update storage.objects set metadata = '{"m":1}' where name = 'b6000000-0000-4000-8000-000000000006/ajena.jpg' $$,
   '{superadmin,multimedia,eventos_multimedia}'),
  ('renombrar la propia', $$ update storage.objects set name = auth.uid() || '/renombrada.jpg' where name = auth.uid() || '/propia.jpg' $$,
   '{superadmin,editor,eventos,multimedia,eventos_multimedia}'),
  ('mover la propia a carpeta ajena', $$ update storage.objects set name = 'b6000000-0000-4000-8000-000000000006/plantada.jpg' where name = auth.uid() || '/propia.jpg' $$,
   '{}'),
  ('mover una ajena a otra carpeta', $$ update storage.objects set name = 'b1000000-0000-4000-8000-000000000001/movida.jpg' where name = 'b6000000-0000-4000-8000-000000000006/ajena.jpg' $$,
   '{}'),
  ('borrar la propia', $$ delete from storage.objects where name = auth.uid() || '/propia.jpg' $$,
   '{superadmin,editor,eventos,multimedia,eventos_multimedia}'),
  ('borrar ajena', $$ delete from storage.objects where name = 'b6000000-0000-4000-8000-000000000006/ajena.jpg' $$,
   '{superadmin,multimedia,eventos_multimedia}'),
  ('listar foto no publicada', $$ select 1 from storage.objects where name = 'b6000000-0000-4000-8000-000000000006/actividad-borrador.jpg' $$,
   '{superadmin,editor,eventos,multimedia,eventos_multimedia}'),
  ('listar foto publicada', $$ select 1 from storage.objects where name = 'diseno/784625ac3ebfe474ed6261cca016b8df.jpg' $$,
   '{superadmin,superadmin_sin_2fa,superadmin_factor_nuevo,editor,eventos,multimedia,eventos_multimedia,inactivo,sin_rol,editor_sesion_cerrada,anon}');

select is(pg_temp.puede(a.clave, x.sql), a.clave = any (x.permitidos),
          format('6 · %s → %s: %s', a.clave, x.accion, case when a.clave = any (x.permitidos) then 'puede' else 'no puede' end))
from actores a cross join acciones_storage x
order by x.accion, a.clave;

-- =============================================================================
-- 7. Doble factor (además de las filas de la matriz)
-- =============================================================================
select ok(pg_temp.puede('superadmin', $$ select 1 where tiene_rol('superadmin') $$),
  '7 · Superadmin con su factor y sesión aal2 tiene el rol');
select ok(not pg_temp.puede('superadmin_sin_2fa', $$ select 1 where tiene_rol('superadmin') $$),
  '7 · Una sesión de solo contraseña (aal1) no tiene el rol de superadmin');
select ok(not pg_temp.puede('superadmin_factor_nuevo', $$ select 1 where tiene_rol('superadmin') $$),
  '7 · HALLAZGO · Un factor inscrito después de recibir el rol no habilita al superadmin');
select is(pg_temp.resultado('superadmin_sin_2fa', $$ select r from mis_roles() r $$), 'ok:1',
  '7 · mis_roles() sigue informando el rol para que el panel pida el doble factor');

-- =============================================================================
-- 8. Desactivar a alguien o cerrar su sesión corta el acceso de inmediato
-- =============================================================================
insert into auth.sessions (id, user_id, aal, created_at, updated_at)
values ('5e550000-0000-4000-8000-000000000008', 'b8000000-0000-4000-8000-000000000008', 'aal1', now(), now());
insert into auth.refresh_tokens (token, user_id, session_id, revoked, created_at, updated_at)
values ('token-de-prueba-b8', 'b8000000-0000-4000-8000-000000000008', '5e550000-0000-4000-8000-000000000008', false, now(), now());
update perfiles set activo = false where user_id = 'b8000000-0000-4000-8000-000000000008';
select is((select count(*)::int from auth.sessions where user_id = 'b8000000-0000-4000-8000-000000000008'), 0,
  '8 · HALLAZGO · Al desactivar a alguien se cierran todas sus sesiones');
select is((select count(*)::int from auth.refresh_tokens where user_id::uuid = 'b8000000-0000-4000-8000-000000000008' and not revoked), 0,
  '8 · HALLAZGO · …y ya no puede renovar su sesión');
select ok((select banned_until > now() from auth.users where id = 'b8000000-0000-4000-8000-000000000008'),
  '8 · HALLAZGO · …ni volver a iniciar sesión mientras esté desactivado');
update perfiles set activo = true where user_id = 'b8000000-0000-4000-8000-000000000008';
select is((select banned_until from auth.users where id = 'b8000000-0000-4000-8000-000000000008'), null,
  '8 · Al reactivarlo puede volver a iniciar sesión');

select * from finish();
rollback;
