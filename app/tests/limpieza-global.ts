/**
 * Al terminar todas las pruebas: borra las cuentas de prueba (@prueba.test)
 * que crearon las pruebas del panel. Cada archivo ya borra su contenido de
 * prueba (artículos, fotos, actividades, álbumes, videos).
 * Superadministrador: la base nunca deja sin un superadmin activo, así que
 * la última cuenta de prueba con ese rol queda (solo en el Supabase local).
 */
const URL_API = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export default async function limpiezaGlobal() {
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL_API) || !SERVICIO) return;
  const h = { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}`, 'Content-Type': 'application/json' };
  const perfiles = (await (await fetch(`${URL_API}/rest/v1/perfiles?correo=like.*@prueba.test&select=user_id,perfil_roles(rol)`, { headers: h })).json()) as
    { user_id: string; perfil_roles: { rol: string }[] }[];
  // Primero quienes no son superadmin; luego los superadmin (la base deja el último).
  const orden = [...perfiles].sort((a, b) => Number(a.perfil_roles.some((r) => r.rol === 'superadmin')) - Number(b.perfil_roles.some((r) => r.rol === 'superadmin')));
  for (const p of orden) {
    await fetch(`${URL_API}/auth/v1/admin/users/${p.user_id}`, { method: 'DELETE', headers: h }).catch(() => undefined);
  }
}
