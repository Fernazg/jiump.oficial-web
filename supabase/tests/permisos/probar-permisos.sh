#!/usr/bin/env bash
# Compara los permisos efectivos de anon, authenticated y service_role en el
# esquema public con los esperados (esperados.tsv).
#
# La base local parte SIN permisos por defecto, igual que producción
# (supabase/roles.sql, que la CLI aplica antes de las migraciones en
# `supabase db reset`). Por eso, si esta prueba pasa, todas las migraciones
# juntas dejan en producción exactamente estos permisos.
#
# Si falla después de agregar una tabla o función: agregar sus GRANT
# explícitos en la migración y, si el cambio es intencional, regenerar
# esperados.tsv con:
#   docker exec -i supabase_db_jiump-oficial-web psql -U postgres -d postgres -X -q -At -F "$(printf '\t')" \
#     < supabase/scripts/permisos-efectivos.sql > supabase/tests/permisos/esperados.tsv
set -euo pipefail
cd "$(dirname "$0")/../../.."

contenedor=$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -1)
[ -n "$contenedor" ] || { echo "No encontré el contenedor de la base local (supabase_db_…)."; exit 2; }

# La prueba solo vale si la base partió sin permisos por defecto en public.
por_defecto=$(docker exec -i "$contenedor" psql -U postgres -d postgres -X -q -At -c "
  select count(*) from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  cross join lateral aclexplode(d.defaclacl) g
  where n.nspname = 'public' and d.defaclrole = 'postgres'::regrole
    and g.grantee in ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)")
if [ "$por_defecto" != "0" ]; then
  echo "✘ La base local tiene permisos por defecto en public para anon/authenticated/service_role."
  echo "  Debe partir sin ellos, como producción: revisar supabase/roles.sql y correr \`supabase db reset\`."
  exit 1
fi

actual=$(mktemp)
trap 'rm -f "$actual"' EXIT
docker exec -i "$contenedor" psql -U postgres -d postgres -X -q -At -v ON_ERROR_STOP=1 -F "$(printf '\t')" \
  < supabase/scripts/permisos-efectivos.sql > "$actual"

if diff -u supabase/tests/permisos/esperados.tsv "$actual" > /dev/null; then
  echo "✔ Permisos de anon, authenticated y service_role iguales a los esperados ($(wc -l < "$actual") permisos), partiendo de una base sin permisos por defecto."
else
  echo "✘ Los permisos no son los esperados (− esperado, + actual):"
  diff -u supabase/tests/permisos/esperados.tsv "$actual" | grep '^[-+][^-+]' | head -50
  exit 1
fi
