-- =============================================================================
-- Privacidad: qué columnas ve el visitante (migración 12).
-- Ejecutar con: supabase test db
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select * from no_plan();

-- Ninguna tabla entrega al visitante columnas internas.
select is(
  (select count(*)::int from information_schema.column_privileges
   where grantee = 'anon' and table_schema = 'public'
     and column_name in ('creado_por', 'actualizado_por', 'estado_antes_papelera', 'en_papelera_desde')),
  0, 'El visitante no tiene permiso sobre quién creó o editó, ni sobre la papelera');
select is(
  (select count(*)::int from information_schema.role_table_grants
   where grantee = 'anon' and table_schema = 'public'),
  0, 'El visitante no tiene permisos de tabla completa: solo columna por columna');
select is(
  (select count(*)::int from information_schema.column_privileges
   where grantee = 'anon' and table_schema = 'public' and privilege_type <> 'SELECT'),
  0, 'El visitante solo puede leer');

set local role anon;
select throws_ok($$ select creado_por from articulos limit 1 $$, '42501', null, 'Visitante: no puede leer quién creó un artículo');
select throws_ok($$ select actualizado_por from fotos limit 1 $$, '42501', null, 'Visitante: no puede leer quién editó una foto');
select throws_ok($$ select * from actividades limit 1 $$, '42501', null, 'Visitante: pedir todas las columnas se rechaza');
select throws_ok($$ select en_papelera_desde from articulos limit 1 $$, '42501', null, 'Visitante: no puede leer datos de la papelera');
select lives_ok($$ select id, titulo, slug, bajada, autor, serie_id, parte, portada_foto_id, cuerpo, estado, publicado_en, minutos_lectura from articulos $$,
  'Visitante: sí lee las columnas que muestra el sitio (artículos)');
select lives_ok($$ select id, archivo, ancho, alto, texto_alternativo, credito, anchos from fotos $$,
  'Visitante: sí lee las columnas que muestra el sitio (fotos)');
select lives_ok($$ select modo_mantenimiento, instagram_url, mostrar_barra_proximo_evento, seo_titulo, seo_descripcion, mantenimiento_foto_id from configuracion $$,
  'Visitante: sí lee la configuración pública');
select is((select count(*)::int from buscar_articulos('reforma')), 2, 'Visitante: la búsqueda sigue funcionando');
select ok(not exists (select 1 from buscar_articulos('reforma') b where to_jsonb(b) ? 'creado_por'),
  'La búsqueda no devuelve columnas internas');
reset role;

-- El equipo (con sesión) conserva el acceso completo a las columnas; RLS sigue filtrando las filas.
select ok(has_column_privilege('authenticated', 'public.articulos', 'creado_por', 'select'),
  'El equipo sí puede leer quién creó un artículo');

-- Redirecciones: un destino que parece ruta pero lleva a otro dominio se rechaza.
select throws_ok($$ insert into redirecciones (origen, destino) values ('/prueba-a', '//otro-sitio.example') $$, '23514', null,
  'Redirección a «//otro-sitio» rechazada');
select throws_ok($$ insert into redirecciones (origen, destino) values ('/prueba-b', '/\otro-sitio.example') $$, '23514', null,
  'Redirección a «/\otro-sitio» rechazada');
select lives_ok($$ insert into redirecciones (origen, destino) values ('/prueba-c', '/articulos') $$, 'Redirección interna aceptada');
select lives_ok($$ insert into redirecciones (origen, destino) values ('/prueba-d', 'https://www.instagram.com/jiump.oficial') $$, 'Redirección externa con https aceptada');

select * from finish();
rollback;
