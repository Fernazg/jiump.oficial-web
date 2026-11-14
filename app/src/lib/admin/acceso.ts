import 'server-only';
import { forbidden, redirect } from 'next/navigation';
import { cache } from 'react';
import { type ClaveSeccion, puedeEntrar, type Rol } from './secciones';
import { clientePanel } from './supabase-panel';

export type Acceso = {
  userId: string;
  correo: string;
  nombre: string;
  /** Roles asignados (aunque aún no cuenten en esta sesión). */
  roles: Rol[];
  /** Roles que la base de datos reconoce en ESTA sesión (los que dan permisos). */
  efectivos: Rol[];
  /** Nivel de la sesión: aal2 = verificada con el segundo factor. */
  nivel: 'aal1' | 'aal2';
  /** La persona tiene un factor TOTP inscrito y verificado. */
  tieneFactor: boolean;
  /** Debe ingresar el código de su app antes de seguir. */
  debeVerificar: boolean;
  /** Superadmin sin factor: debe inscribirlo antes de seguir. */
  debeInscribir: boolean;
};

/**
 * Acceso de la persona en esta petición. Valida la sesión con Supabase Auth
 * (no solo la cookie) y pregunta a la base qué roles cuentan: si cerró sesión
 * o la desactivaron, la sesión ya no existe y no tiene acceso.
 */
export const obtenerAcceso = cache(async (): Promise<Acceso | null> => {
  const supabase = await clientePanel();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: acceso }, { data: nivel }] = await Promise.all([
    supabase.rpc('mi_acceso'),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!acceso || acceso.activo !== true) return null;

  const factores = (user.factors ?? []).filter((f) => f.factor_type === 'totp' && f.status === 'verified');
  const roles = (acceso.roles ?? []) as Rol[];
  const actual = nivel?.currentLevel === 'aal2' ? 'aal2' : 'aal1';
  return {
    userId: user.id,
    correo: user.email ?? acceso.correo ?? '',
    nombre: acceso.nombre || (user.email ?? '').split('@')[0],
    roles,
    efectivos: (acceso.efectivos ?? []) as Rol[],
    nivel: actual,
    tieneFactor: factores.length > 0,
    debeVerificar: factores.length > 0 && actual !== 'aal2',
    debeInscribir: roles.includes('superadmin') && factores.length === 0,
  };
});

/** Exige sesión completa (con 2FA cuando corresponde) y una persona del equipo. */
export async function exigirAcceso(): Promise<Acceso> {
  const acceso = await obtenerAcceso();
  if (!acceso) redirect('/admin/ingresar');
  if (acceso.roles.length === 0) redirect('/admin/salir?motivo=sin-roles');
  if (acceso.debeVerificar) redirect('/admin/verificar');
  if (acceso.debeInscribir) redirect('/admin/doble-factor');
  return acceso;
}

/**
 * Exige permiso para una sección. Se llama en cada página y en cada acción
 * del servidor (además del proxy y de RLS): sin permiso responde 403.
 */
export async function exigirSeccion(clave: ClaveSeccion): Promise<Acceso> {
  const acceso = await exigirAcceso();
  if (!puedeEntrar(clave, acceso.efectivos, acceso.roles)) forbidden();
  return acceso;
}

/** Igual que exigirSeccion, para acciones: devuelve un error en vez de 403. */
export async function permisoAccion(clave: ClaveSeccion): Promise<Acceso | null> {
  const acceso = await obtenerAcceso();
  if (!acceso || acceso.debeVerificar || acceso.debeInscribir) return null;
  return puedeEntrar(clave, acceso.efectivos, acceso.roles) ? acceso : null;
}
