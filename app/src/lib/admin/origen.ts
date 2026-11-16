import 'server-only';
import { headers } from 'next/headers';

/**
 * Dirección con la que la persona llegó al panel (ej.: https://jiump.cl), para
 * armar los enlaces de los correos (recuperar contraseña, invitación).
 * Supabase solo acepta destinos de su lista de URL permitidas.
 */
export async function origen(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${host}`;
}
