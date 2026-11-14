import { NextResponse, type NextRequest } from 'next/server';
import { clientePanel } from '@/lib/admin/supabase-panel';

/**
 * Cierra la sesión y vuelve a «Ingresar» con un motivo. La usa el proxy
 * cuando la cuenta fue desactivada o no tiene roles.
 */
export async function GET(request: NextRequest) {
  const motivo = request.nextUrl.searchParams.get('motivo');
  const supabase = await clientePanel();
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  const r = NextResponse.redirect(new URL(`/admin/ingresar?motivo=${motivo === 'sin-roles' ? 'sin-roles' : 'inactivo'}`, request.url));
  for (const c of request.cookies.getAll()) if (c.name.startsWith('sb-')) r.cookies.delete(c.name);
  r.headers.set('Cache-Control', 'private, no-store');
  return r;
}
