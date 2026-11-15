#!/usr/bin/env bash
# Levanta Supabase local en el runner de GitHub Actions.
#
# A veces el runner falla al arrancar un contenedor porque un puerto ya está
# ocupado («address already in use» / «port is already allocated»): es un
# problema del entorno, no del código. Si pasa, se muestra quién ocupa los
# puertos de Supabase, se limpian los contenedores a medio arrancar y se
# reintenta UNA vez. Cualquier otro error falla de inmediato, sin reintentar.
#
# Uso: SUPABASE_CLI=supabase@x.y.z .github/scripts/levantar-supabase.sh <servicios a excluir>
set -uo pipefail

EXCLUIR="${1:?Indica los servicios a excluir (lista separada por comas)}"
CLI="${SUPABASE_CLI:?Falta SUPABASE_CLI}"
REGISTRO="$(mktemp)"
PUERTOS='54321 54322 54324'   # API, base de datos, Mailpit (supabase/config.toml)

levantar() {
  npx --yes "$CLI" start -x "$EXCLUIR" 2>&1 | tee "$REGISTRO"
  return "${PIPESTATUS[0]}"
}

ocupado() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

mostrar_puertos() {
  for p in $PUERTOS; do
    if ocupado "$p"; then
      echo "Puerto $p ocupado por:"
      if command -v ss >/dev/null; then sudo ss -ltnp "sport = :$p" | tail -n +2 || true; fi
    fi
  done
}

if levantar; then exit 0; fi

if ! grep -qiE 'address already in use|port is already allocated' "$REGISTRO"; then
  echo "::error::Supabase no arrancó (no es un puerto ocupado): no se reintenta."
  exit 1
fi

echo "::warning::Supabase no arrancó porque un puerto estaba ocupado en el runner. Se limpia y se reintenta una vez."
mostrar_puertos
npx --yes "$CLI" stop --no-backup || true
docker ps -aq --filter 'name=supabase_' | xargs -r docker rm -f >/dev/null 2>&1 || true

# Espera (hasta 30 s) a que se liberen los puertos.
for _ in $(seq 1 15); do
  libres=1
  for p in $PUERTOS; do ocupado "$p" && libres=0; done
  [ "$libres" = 1 ] && break
  sleep 2
done
mostrar_puertos

if levantar; then
  echo "::notice::Supabase arrancó en el segundo intento."
  exit 0
fi
echo "::error::Supabase tampoco arrancó en el segundo intento."
exit 1
