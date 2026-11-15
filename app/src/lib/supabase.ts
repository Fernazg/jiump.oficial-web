import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase para el sitio público.
 *
 * Usa SOLO la clave anónima: todo lo que se lee pasa por las políticas RLS,
 * así que el sitio no puede ver borradores aunque tuviera un error. Si por
 * descuido se configura una clave con más privilegios (service role / secret),
 * el sitio se niega a arrancar.
 */
export function leerConfiguracion(): { url: string; clave: string } {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_ANON_KEY;
  if (!url || !clave) {
    throw new Error('Faltan SUPABASE_URL y SUPABASE_ANON_KEY (ver app/.env.example).');
  }
  verificarClaveAnonima(clave);
  return { url, clave };
}

export function verificarClaveAnonima(clave: string): void {
  if (clave.startsWith('sb_secret_')) {
    throw new Error('SUPABASE_ANON_KEY contiene una clave secreta. El sitio solo puede usar la clave anónima.');
  }
  if (clave.startsWith('sb_publishable_')) return;
  const partes = clave.split('.');
  if (partes.length !== 3) {
    throw new Error('SUPABASE_ANON_KEY no tiene el formato de una clave de Supabase.');
  }
  let rol: unknown;
  try {
    rol = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8')).role;
  } catch {
    throw new Error('No se pudo leer SUPABASE_ANON_KEY.');
  }
  if (rol !== 'anon') {
    throw new Error(`SUPABASE_ANON_KEY tiene el rol «${String(rol)}». El sitio solo puede usar la clave anónima.`);
  }
}

/** Tiempo máximo de una consulta del sitio público a Supabase. */
const TOPE_CONSULTA_MS = 8000;

let cliente: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!cliente) {
    const { url, clave } = leerConfiguracion();
    cliente = createClient(url, clave, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      // Si la base no responde, el visitante ve el aviso de error en pocos segundos:
      // sin los reintentos automáticos (que sumaban ~14 s por visita) y con un tope por consulta.
      db: { retry: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: init?.signal ?? AbortSignal.timeout(TOPE_CONSULTA_MS) }) },
    });
  }
  return cliente;
}
