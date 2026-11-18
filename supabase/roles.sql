-- Se ejecuta en `supabase start` y `supabase db reset`, ANTES de las migraciones.
--
-- Deja la base local igual que producción: el proyecto de Supabase en la nube
-- se creó con «exponer automáticamente nuevas tablas» desactivado, así que lo
-- que crean las migraciones no recibe ningún permiso por defecto para anon,
-- authenticated ni service_role. Sin este archivo, la base local sí los da y
-- una migración que olvide sus GRANT pasaría todas las pruebas y fallaría en
-- producción («permission denied for table …»).
--
-- Cada tabla, vista, secuencia o función nueva debe llevar sus GRANT
-- explícitos en su migración. La prueba supabase/tests/permisos/probar-permisos.sh
-- compara el resultado con supabase/tests/permisos/esperados.tsv.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role;
