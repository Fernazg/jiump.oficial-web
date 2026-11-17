-- Pruebas de la migración version_sitio: el contador que usa el Worker para
-- saber si una página pública guardada sigue vigente.
-- Ejecutar con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

create function pg_temp.version() returns text language sql as $$ select estado_sitio('{/}') ->> 'version' $$;

-- Lo que ve un visitante
set local role anon;
select ok(estado_sitio('{/}') ? 'version', 'Un visitante puede consultar estado_sitio()');
select is((estado_sitio('{/}') ->> 'mantenimiento')::boolean, false, 'Sin mantenimiento');
select is((estado_sitio('{/no-existe}') ->> 'redireccion')::boolean, false, 'Sin redirección para una ruta cualquiera');
select throws_ok($$ select * from version_sitio $$, '42501', null, 'Un visitante no lee la tabla directamente');
select throws_ok($$ update version_sitio set valor = 0 $$, '42501', null, 'Un visitante no escribe la tabla');
select throws_ok($$ select subir_version_sitio() $$, '42501', null, 'Un visitante no puede subir la versión');
reset role;

-- La versión sube con cada cambio del contenido público
create temp table v as select pg_temp.version() as antes;
insert into articulos (titulo, slug) values ('Borrador de prueba', 'borrador-version-sitio');
select isnt(pg_temp.version(), (select antes from v), 'Crear un artículo cambia la versión');

update v set antes = pg_temp.version();
insert into redirecciones (origen, destino) values ('/antigua-version-sitio', '/');
select isnt(pg_temp.version(), (select antes from v), 'Agregar una redirección cambia la versión');
select is((estado_sitio('{/otra,/antigua-version-sitio}') ->> 'redireccion')::boolean, true, 'estado_sitio() ve la redirección');

update v set antes = pg_temp.version();
update configuracion set modo_mantenimiento = true;
select isnt(pg_temp.version(), (select antes from v), 'Activar mantenimiento cambia la versión');
select is((estado_sitio('{/}') ->> 'mantenimiento')::boolean, true, 'estado_sitio() ve el mantenimiento');

-- Un artículo programado que llega a su hora cambia la versión sin que nadie edite nada
update v set antes = pg_temp.version();
alter table articulos disable trigger user;
insert into articulos (titulo, slug, estado, publicar_en) values ('Programado', 'programado-version-sitio', 'programado', now() - interval '1 minute');
alter table articulos enable trigger user;
select isnt(pg_temp.version(), (select antes from v), 'Un artículo programado que ya llegó a su hora cambia la versión');

select * from finish();
rollback;
