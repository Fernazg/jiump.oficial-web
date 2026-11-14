import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { destinoSeguro } from '@/lib/admin/secciones';
import { clientePanel } from '@/lib/admin/supabase-panel';

/**
 * Destino de los enlaces que envía Supabase Auth (recuperar contraseña).
 * Canjea el código o el token por una sesión y sigue al paso indicado.
 */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const siguiente = destinoSeguro(p.get('siguiente'), '/admin/nueva-clave');
  const supabase = await clientePanel();
  let ok = false;
  const codigo = p.get('code');
  const tokenHash = p.get('token_hash');
  const tipo = p.get('type') as EmailOtpType | null;
  if (codigo) {
    ok = !(await supabase.auth.exchangeCodeForSession(codigo)).error;
  } else if (tokenHash && tipo === 'recovery') {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo })).error;
  }
  const destino = ok ? siguiente : '/admin/ingresar?motivo=enlace';
  const r = NextResponse.redirect(new URL(destino, request.url));
  r.headers.set('Cache-Control', 'private, no-store');
  return r;
}
