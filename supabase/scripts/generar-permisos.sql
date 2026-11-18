-- Genera el cuerpo de la migración de permisos explícitos a partir de los
-- permisos REALES de una base ya migrada (la local, después de `supabase db reset`).
--
-- Para cada tabla, columna, secuencia y función del esquema public: quita todo
-- a anon, authenticated y service_role y vuelve a otorgar exactamente lo que
-- tienen en la base de origen. No toca PUBLIC, la RLS ni los dueños.
--
-- Uso (desde la raíz del repositorio, con Supabase local arriba):
--   docker exec -i supabase_db_jiump-oficial-web psql -U postgres -d postgres -X -q -At \
--     < supabase/scripts/generar-permisos.sql
with roles(rol) as (values ('anon'), ('authenticated'), ('service_role')),
rel as (
  select c.oid, c.relname, case c.relkind when 'S' then 'sequence' else 'table' end as clase
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
),
fn as (
  select p.oid, format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) as firma,
         case p.prokind when 'p' then 'procedure' else 'function' end as clase
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f', 'p')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
),
lineas as (
  -- Esquema
  select 0 as grupo, '' as clave, 0 as paso,
         'grant usage on schema public to ' || string_agg(r.rol, ', ' order by r.rol) || ';' as sql
  from roles r
  where has_schema_privilege(r.rol, 'public', 'USAGE')

  -- Tablas, vistas y secuencias: quitar todo y otorgar lo de la base de origen
  union all
  select 1, rel.relname, 0,
         format('revoke all on %s public.%I from anon, authenticated, service_role;', rel.clase, rel.relname)
  from rel
  union all
  select 1, rel.relname, 1,
         format('grant %s on %s public.%I to %s;',
                lower(string_agg(g.privilege_type, ', ' order by g.privilege_type)), rel.clase, rel.relname, g.grantee::regrole)
  from rel
  join pg_class c on c.oid = rel.oid
  cross join lateral aclexplode(c.relacl) g
  where g.grantee in ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)
  group by rel.relname, rel.clase, g.grantee

  -- Permisos por columna (el visitante solo lee columnas públicas)
  union all
  select 1, x.relname, 2,
         format('grant %s (%s) on table public.%I to %s;', lower(x.privilege_type), string_agg(quote_ident(x.attname), ', ' order by x.attnum), x.relname, x.grantee::regrole)
  from (
    select c.relname, a.attname, a.attnum, g.privilege_type, g.grantee
    from rel
    join pg_class c on c.oid = rel.oid
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    cross join lateral aclexplode(a.attacl) g
    where g.grantee in ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)
  ) x
  group by x.relname, x.privilege_type, x.grantee

  -- Funciones: quitar y otorgar EXECUTE a quien lo tiene efectivamente (directo o vía PUBLIC)
  union all
  select 2, fn.firma, 0, format('revoke all on %s %s from anon, authenticated, service_role;', fn.clase, fn.firma)
  from fn
  union all
  select 2, fn.firma, 1, format('grant execute on %s %s to %s;', fn.clase, fn.firma, string_agg(r.rol, ', ' order by r.rol))
  from fn cross join roles r
  where has_function_privilege(r.rol, fn.oid, 'EXECUTE')
  group by fn.firma, fn.clase
)
select sql from lineas order by grupo, clave, paso, sql;
