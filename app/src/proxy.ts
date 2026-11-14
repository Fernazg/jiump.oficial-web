import { NextResponse, type NextRequest } from 'next/server';
import { protegerAdmin } from '@/lib/admin/proxy-admin';

/**
 * Antes de cada página:
 *  0. Panel /admin: exige sesión y permisos (ver lib/admin/proxy-admin.ts).
 *     El panel no se ve afectado por el modo mantenimiento ni las redirecciones,
 *     para que el equipo siempre pueda entrar (y desactivarlo).
 *  1. Modo mantenimiento (configuracion.modo_mantenimiento): muestra la página
 *     de mantenimiento con estado 503 en todo el sitio.
 *  2. Redirecciones 301 desde las URL antiguas de Wix (tabla redirecciones).
 * Lee con la clave anónima. Si Supabase no responde, el sitio sigue normal.
 */
export async function proxy(request: NextRequest) {
  const ruta = request.nextUrl.pathname;
  if (ruta === '/admin' || ruta.startsWith('/admin/')) return protegerAdmin(request);

  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_ANON_KEY;
  if (!url || !clave) return NextResponse.next();

  const cabeceras = { apikey: clave, Authorization: `Bearer ${clave}` };
  const leer = async (consulta: string) => {
    try {
      const r = await fetch(`${url}/rest/v1/${consulta}`, { headers: cabeceras, cache: 'no-store', signal: AbortSignal.timeout(2500) });
      return r.ok ? ((await r.json()) as Record<string, unknown>[]) : [];
    } catch {
      return [];
    }
  };

  let decodificada = ruta;
  try { decodificada = decodeURIComponent(ruta); } catch { /* ruta mal codificada: se busca tal cual */ }
  const candidatas = [...new Set([ruta, decodificada, decodificada.length > 1 ? decodificada.replace(/\/+$/, '') : decodificada])];
  const filtro = encodeURIComponent(`(${candidatas.map((r) => `"${r.replace(/["\\]/g, '')}"`).join(',')})`);
  const [conf, redir] = await Promise.all([
    leer('configuracion?select=modo_mantenimiento'),
    leer(`redirecciones?select=destino,codigo&origen=in.${filtro}&limit=1`),
  ]);

  if (conf[0]?.modo_mantenimiento === true) {
    if (ruta === '/mantenimiento') return NextResponse.next();
    return NextResponse.rewrite(new URL('/mantenimiento', request.url), { status: 503, headers: { 'Retry-After': '3600' } });
  }

  const destino = redir[0]?.destino;
  if (typeof destino === 'string') {
    return NextResponse.redirect(new URL(destino, request.url), Number(redir[0].codigo) || 301);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/|marca/|favicon.ico|robots.txt).*)'],
};
