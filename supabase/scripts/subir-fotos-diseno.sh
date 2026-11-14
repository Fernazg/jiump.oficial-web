#!/usr/bin/env bash
# Sube las fotos reales de design/fotos/ al bucket «fotos» del Supabase LOCAL,
# en la ruta diseno/<archivo> que usa supabase/seed.sql.
#
# Uso (la clave se toma de `supabase status`, nunca se guarda en el repo):
#   SUPABASE_SERVICE_ROLE_KEY=... supabase/scripts/subir-fotos-diseno.sh
set -euo pipefail

URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
KEY="${SUPABASE_SERVICE_ROLE_KEY:?Define SUPABASE_SERVICE_ROLE_KEY (ver: supabase status)}"

case "$URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "Este script es solo para el entorno local ($URL no es local)." >&2; exit 1 ;;
esac

fallas=0
DIR="$(cd "$(dirname "$0")/../../design/fotos" && pwd)"
for f in "$DIR"/*.jpg "$DIR"/*.png; do
  nombre="$(basename "$f")"
  case "$nombre" in *.png) tipo=image/png ;; *) tipo=image/jpeg ;; esac
  codigo=$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
    "$URL/storage/v1/object/fotos/diseno/$nombre" \
    -H "Authorization: Bearer $KEY" -H "apikey: $KEY" \
    -H "Content-Type: $tipo" -H "x-upsert: true" \
    --data-binary "@$f")
  echo "$codigo $nombre"
  [ "$codigo" = "200" ] || fallas=$((fallas + 1))
done

if [ "$fallas" -gt 0 ]; then
  echo "Fallaron $fallas subidas." >&2
  exit 1
fi
