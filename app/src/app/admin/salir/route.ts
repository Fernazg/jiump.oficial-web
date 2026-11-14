import { NextResponse, type NextRequest } from 'next/server';
import { clientePanel } from '@/lib/admin/supabase-panel';

/**
 * Cerrar sesión. Borra la sesión en Supabase (el acceso se corta al instante,
 * también para cualquier token ya emitido) y las cookies.
 *  · POST: botón «Cerrar sesión» (formulario normal, funciona en cualquier página).
 *  · GET: lo usa el proxy cuando la cuenta fue desactivada o no tiene roles.
 */
async function salir(request: NextRequest, motivo: string) {
  const supabase = await clientePanel();
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  const r = NextResponse.redirect(new URL(`/admin/ingresar?motivo=${motivo}`, request.url), 303);
  for (const c of request.cookies.getAll()) if (c.name.startsWith('sb-')) r.cookies.delete(c.name);
  r.headers.set('Cache-Control', 'private, no-store');
  return r;
}

export async function POST(request: NextRequest) {
  return salir(request, 'salida');
}

export async function GET(request: NextRequest) {
  return salir(request, request.nextUrl.searchParams.get('motivo') === 'sin-roles' ? 'sin-roles' : 'inactivo');
}
