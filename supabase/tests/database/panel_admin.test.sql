-- Pruebas de la migración 8 (panel /admin, etapa 1): acceso de la sesión,
-- vista previa obligatoria, cambios pendientes, presencia y papelera.
-- Ejecutar con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(28);

-- Usuarios ficticios (solo existen dentro de esta transacción)
create function pg_temp.crear_usuario(p_id uuid, p_correo text, p_roles rol_app[])
returns void language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_correo, jsonb_build_object('nombre', initcap(split_part(p_correo, '@', 1))));
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

select pg_temp.crear_usuario('a1000000-0000-4000-8000-000000000001', 'superpanel@pgtap.prueba', '{superadmin}');
select pg_temp.crear_usuario('a2000000-0000-4000-8000-000000000002', 'editorpanel@pgtap.prueba', '{editor}');
select pg_temp.crear_usuario('a3000000-0000-4000-8000-000000000003', 'eventospanel@pgtap.prueba', '{eventos}');

insert into articulos (id, titulo, slug, cuerpo) values
  ('ab000000-0000-4000-8000-000000000001', 'Borrador del panel', 'borrador-del-panel', '[{"tipo":"parrafo","texto":"Hola"}]');

-- -----------------------------------------------------------------------------
-- mi_acceso(): roles asignados y roles que cuentan en esta sesión
-- -----------------------------------------------------------------------------
select pg_temp.como('a2000000-0000-4000-8000-000000000002');
select is(mi_acceso() -> 'efectivos', '["editor"]'::jsonb, 'Editor: su rol cuenta en la sesión');
select is(mi_acceso() ->> 'nombre', 'Editorpanel', 'mi_acceso() devuelve el nombre del perfil propio');

select pg_temp.como('a1000000-0000-4000-8000-000000000001', 'aal1');
select is(mi_acceso() -> 'roles', '["superadmin"]'::jsonb, 'Superadmin sin 2FA: el rol aparece como asignado');
select is(mi_acceso() -> 'efectivos', '[]'::jsonb, 'Superadmin sin 2FA: el rol no cuenta');
select pg_temp.como('a1000000-0000-4000-8000-000000000001', 'aal2');
select is(mi_acceso() -> 'efectivos', '["superadmin"]'::jsonb, 'Superadmin con 2FA: el rol cuenta');

-- -----------------------------------------------------------------------------
-- Vista previa obligatoria
-- -----------------------------------------------------------------------------
select pg_temp.como('a2000000-0000-4000-8000-000000000002');
select throws_ok($$ update articulos set estado = 'publicado' where id = 'ab000000-0000-4000-8000-000000000001' $$,
  'P0001', 'Antes de publicar hay que revisar la vista previa de este contenido', 'Sin vista previa no se publica');
select throws_ok($$ update articulos set estado = 'programado', publicar_en = now() + interval '1 day'
  where id = 'ab000000-0000-4000-8000-000000000001' $$,
  'P0001', null, 'Sin vista previa no se programa');
select throws_ok($$ insert into articulos (titulo, slug, estado) values ('x', 'publicado-directo', 'publicado') $$,
  'P0001', null, 'No se puede crear un artículo ya publicado');
select throws_ok($$ insert into articulo_vistas_previas (articulo_id, huella) values ('ab000000-0000-4000-8000-000000000001', 'inventada') $$,
  '42501', null, 'La huella de la vista previa la calcula la base (no se puede inventar)');

insert into articulo_vistas_previas (articulo_id, huella)
values ('ab000000-0000-4000-8000-000000000001', huella_vigente_articulo('ab000000-0000-4000-8000-000000000001'));
select lives_ok($$ update articulos set estado = 'revision' where id = 'ab000000-0000-4000-8000-000000000001' $$,
  'Enviar a revisión no exige vista previa');

-- Otra persona no puede usar la vista previa ajena
select pg_temp.como('a1000000-0000-4000-8000-000000000001', 'aal2');
select throws_ok($$ update articulos set estado = 'publicado' where id = 'ab000000-0000-4000-8000-000000000001' $$,
  'P0001', null, 'La vista previa es personal: quien publica debe haberla visto');

select pg_temp.como('a2000000-0000-4000-8000-000000000002');
select lives_ok($$ update articulos set estado = 'publicado' where id = 'ab000000-0000-4000-8000-000000000001' $$,
  'Con la vista previa del mismo contenido, se publica');
select throws_ok($$ update articulos set cuerpo = '[{"tipo":"parrafo","texto":"Cambio sin revisar"}]'
  where id = 'ab000000-0000-4000-8000-000000000001' $$,
  'P0001', null, 'Cambiar el texto de un artículo publicado también exige vista previa');
select lives_ok($$ update articulos set destacado_inicio = true where id = 'ab000000-0000-4000-8000-000000000001' $$,
  'Cambiar algo que no es el contenido no exige vista previa');

-- -----------------------------------------------------------------------------
-- Cambios pendientes de un artículo publicado
-- -----------------------------------------------------------------------------
insert into articulo_cambios (articulo_id, titulo, cuerpo)
values ('ab000000-0000-4000-8000-000000000001', 'Título nuevo', '[{"tipo":"parrafo","texto":"Texto nuevo"}]');
select is((select titulo from articulos where id = 'ab000000-0000-4000-8000-000000000001'), 'Borrador del panel',
  'Los cambios pendientes no tocan el artículo publicado');
select isnt(huella_vigente_articulo('ab000000-0000-4000-8000-000000000001'),
  (select huella_articulo(titulo, bajada, autor, serie_id, parte, portada_foto_id, cuerpo) from articulos where id = 'ab000000-0000-4000-8000-000000000001'),
  'La vista previa vigente es la de los cambios pendientes');
insert into articulo_vistas_previas (articulo_id, huella)
values ('ab000000-0000-4000-8000-000000000001', huella_vigente_articulo('ab000000-0000-4000-8000-000000000001'));
select lives_ok($$ update articulos a set titulo = c.titulo, bajada = c.bajada, autor = c.autor, serie_id = c.serie_id,
    parte = c.parte, portada_foto_id = c.portada_foto_id, cuerpo = c.cuerpo
  from articulo_cambios c where c.articulo_id = a.id and a.id = 'ab000000-0000-4000-8000-000000000001' $$,
  'Con la vista previa de los cambios, se publican');
select is((select count(*)::int from articulo_versiones where articulo_id = 'ab000000-0000-4000-8000-000000000001' and titulo = 'Borrador del panel'),
  1, 'Publicar los cambios guarda la versión anterior');

-- -----------------------------------------------------------------------------
-- Presencia (aviso de edición simultánea)
-- -----------------------------------------------------------------------------
insert into articulo_presencia (articulo_id, nombre) values ('ab000000-0000-4000-8000-000000000001', 'Editorpanel');
select throws_ok($$ insert into articulo_presencia (articulo_id, user_id, nombre)
  values ('ab000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Suplantado') $$,
  '42501', null, 'Nadie marca presencia en nombre de otra persona');
select pg_temp.como('a1000000-0000-4000-8000-000000000001', 'aal2');
select is((select nombre from articulo_presencia where articulo_id = 'ab000000-0000-4000-8000-000000000001'), 'Editorpanel',
  'Superadmin ve quién más tiene abierto el artículo');
delete from articulo_presencia where user_id = 'a2000000-0000-4000-8000-000000000002';
select is((select count(*)::int from articulo_presencia), 1, 'Nadie borra la presencia de otra persona');

-- -----------------------------------------------------------------------------
-- Otros roles y visitante
-- -----------------------------------------------------------------------------
select pg_temp.como('a3000000-0000-4000-8000-000000000003');
select is((select count(*)::int from articulo_presencia), 0, 'Eventos no ve la presencia de artículos');
select throws_ok($$ insert into articulo_cambios (articulo_id, titulo) values ('ab000000-0000-4000-8000-000000000001', 'x') $$,
  '42501', null, 'Eventos no guarda cambios de artículos');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select 1 from articulo_cambios $$, '42501', null, 'El visitante no lee cambios pendientes');
select throws_ok($$ select mi_acceso() $$, '42501', null, 'El visitante no ejecuta mi_acceso()');
reset role;

-- -----------------------------------------------------------------------------
-- Papelera automática
-- -----------------------------------------------------------------------------
select is((select count(*)::int from cron.job where jobname = 'jiump-vaciar-papelera-articulos'), 1,
  'La papelera se vacía sola cada día (pg_cron)');
select ok((select command from cron.job where jobname = 'jiump-vaciar-papelera-articulos') like '%purgar_papelera_articulos%',
  'El trabajo programado llama a purgar_papelera_articulos()');
select ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public' and p.proname in ('mi_acceso', 'huella_articulo', 'huella_vigente_articulo', 'exigir_vista_previa')
                        and p.prosecdef),
  'Las funciones nuevas no son SECURITY DEFINER (respetan RLS)');

select * from finish();
rollback;
