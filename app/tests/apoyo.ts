/**
 * Apoyo para las pruebas: crea y borra datos de prueba directamente en el
 * Supabase LOCAL. Solo las pruebas usan la service role (desde el entorno,
 * nunca desde el sitio ni el repositorio) y se niegan a correr fuera de local.
 */
const URL_API = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function exigirLocal() {
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL_API)) throw new Error(`Las pruebas solo corren contra Supabase local (${URL_API}).`);
  if (!SERVICIO) throw new Error('Define SUPABASE_SERVICE_ROLE_KEY para las pruebas (ver: npx supabase status).');
}

export async function admin<T = unknown>(ruta: string, metodo = 'GET', cuerpo?: unknown): Promise<T> {
  exigirLocal();
  const r = await fetch(`${URL_API}/rest/v1/${ruta}`, {
    method: metodo,
    headers: {
      apikey: SERVICIO!, Authorization: `Bearer ${SERVICIO}`, 'Content-Type': 'application/json', Prefer: 'return=representation',
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${texto}`);
  return (texto ? JSON.parse(texto) : null) as T;
}

/** Textos que nunca deben aparecer (reglas 4 y 5 del README). */
export const PROHIBIDO = /ofrenda|donaci[oó]n|donar\b|aporte econ|diezmo|contacto|recursos|podcast|directorio|realizados?\b/i;
