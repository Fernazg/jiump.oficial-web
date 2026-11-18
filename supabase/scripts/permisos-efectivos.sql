-- Permisos efectivos de anon, authenticated y service_role sobre el esquema
-- public: una fila por objeto, rol y privilegio, en orden fijo.
-- Lo usa supabase/tests/permisos/probar-permisos.sh, que compara el resultado
-- con supabase/tests/permisos/esperados.tsv.
with roles(rol) as (values ('anon'), ('authenticated'), ('service_role')),
esquema as (
  select 'esquema' as tipo, 'public' as objeto, r.rol, p.priv
  from roles r cross join (values ('USAGE'), ('CREATE')) p(priv)
  where has_schema_privilege(r.rol, 'public', p.priv)
),
relaciones as (
  select case c.relkind when 'S' then 'secuencia' when 'v' then 'vista' when 'm' then 'vista_materializada' else 'tabla' end as tipo,
         c.relname::text as objeto, g.grantee::regrole::text as rol, g.privilege_type as priv
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(c.relacl) g
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
    and g.grantee in ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)
),
columnas as (
  select 'columna' as tipo, c.relname || '.' || a.attname as objeto, g.grantee::regrole::text as rol, g.privilege_type as priv
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(a.attacl) g
  where n.nspname = 'public' and a.attnum > 0 and not a.attisdropped
    and g.grantee in ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)
),
-- Funciones: permiso EFECTIVO (incluye el EXECUTE que reciben vía PUBLIC).
funciones as (
  select 'funcion' as tipo, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as objeto, r.rol, 'EXECUTE' as priv
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join roles r
  where n.nspname = 'public' and p.prokind in ('f', 'p')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and has_function_privilege(r.rol, p.oid, 'EXECUTE')
)
select tipo, objeto, rol, priv from (
  select * from esquema union all select * from relaciones
  union all select * from columnas union all select * from funciones
) t
order by tipo, objeto, rol, priv;
