import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { RUTAS_DE_ACCESO, RUTAS_PUBLICAS, puedeEntrar, seccionDeRuta, type Rol } from './secciones';

/**
 * Protección de /admin en el servidor, antes de cada página y de cada acción
 * del servidor (las acciones son POST a la misma ruta):
 *  1. Renueva la sesión (cookies) y la valida con Supabase Auth.
 *  2. Sin sesión → /admin/ingresar.
 *  3. Con doble factor pendiente → /admin/verificar; superadmin sin factor →
 *     /admin/doble-factor.
 *  4. Sección sin permiso para sus roles → 403.
 * Las páginas y las acciones vuelven a comprobarlo, y RLS lo exige en la base.
 */
export async function protegerAdmin(request: NextRequest): Promise<NextResponse> {
  const ruta = request.nextUrl.pathname;
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_ANON_KEY;
  if (!url || !clave) return new NextResponse('Panel sin configurar', { status: 503 });

  let respuesta = NextResponse.next({ request });
  const supabase = createServerClient(url, clave, {
    cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista, cabeceras) => {
        for (const { name, value } of lista) request.cookies.set(name, value);
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of lista) respuesta.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(cabeceras ?? {})) respuesta.headers.set(k, v);
      },
    },
  });

  // Copia las cookies renovadas a una redirección o reescritura.
  const conCookies = (r: NextResponse) => {
    for (const c of respuesta.cookies.getAll()) r.cookies.set(c);
    r.headers.set('Cache-Control', 'private, no-store');
    return r;
  };
  const ir = (destino: string) => conCookies(NextResponse.redirect(new URL(destino, request.url)));

  const esPublica = RUTAS_PUBLICAS.some((r) => ruta === r || ruta.startsWith(`${r}/`));
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    if (esPublica) return conCookies(respuesta);
    // Traía cookies de sesión pero la sesión ya no existe: cerró sesión en otro
    // lado, la desactivaron o venció. Se borran las cookies viejas.
    const cookiesViejas = request.cookies.getAll().filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name));
    const params = new URLSearchParams();
    if (cookiesViejas.length > 0) params.set('motivo', 'inactivo');
    if (ruta !== '/admin' && ruta !== '/admin/salir') params.set('siguiente', ruta + request.nextUrl.search);
    const r = ir(`/admin/ingresar${params.size ? `?${params}` : ''}`);
    for (const c of cookiesViejas) r.cookies.delete(c.name);
    return r;
  }
  if (ruta.startsWith('/admin/auth/') || ruta === '/admin/salir') return conCookies(respuesta);

  const [{ data: acceso }, { data: nivel }] = await Promise.all([
    supabase.rpc('mi_acceso'),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!acceso || acceso.activo !== true) return ir('/admin/salir?motivo=inactivo');
  const roles = (acceso.roles ?? []) as Rol[];
  const efectivos = (acceso.efectivos ?? []) as Rol[];
  if (roles.length === 0) return ir('/admin/salir?motivo=sin-roles');

  const tieneFactor = (user.factors ?? []).some((f) => f.factor_type === 'totp' && f.status === 'verified');
  if (tieneFactor && nivel?.currentLevel !== 'aal2') {
    if (ruta === '/admin/verificar') return conCookies(respuesta);
    const destino = ruta !== '/admin' && !RUTAS_DE_ACCESO.includes(ruta) && !esPublica ? `?siguiente=${encodeURIComponent(ruta + request.nextUrl.search)}` : '';
    return ir(`/admin/verificar${destino}`);
  }
  if (roles.includes('superadmin') && !tieneFactor) {
    return ruta === '/admin/doble-factor' ? conCookies(respuesta) : ir('/admin/doble-factor');
  }
  if (esPublica || ruta === '/admin/verificar') return ir('/admin');
  if (RUTAS_DE_ACCESO.includes(ruta)) return conCookies(respuesta);

  const clave_ = seccionDeRuta(ruta);
  if (!clave_ || !puedeEntrar(clave_, efectivos, roles)) {
    // 403 real (no solo ocultar el enlace). Una acción del servidor (POST) se
    // corta aquí mismo; una página muestra «Sin permiso».
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return conCookies(new NextResponse('Sin permiso', { status: 403 }));
    }
    return conCookies(NextResponse.rewrite(new URL('/admin/sin-permiso', request.url), { status: 403 }));
  }
  return conCookies(respuesta);
}
