import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { obtenerAcceso } from './acceso';

/**
 * ÚNICO uso de la service role en todo el panel: enviar una invitación.
 *
 * Por qué hace falta: crear la cuenta de alguien y mandarle el correo de
 * invitación es una operación de administración de Supabase Auth. Una sesión
 * normal (aunque sea de un Superadmin) no puede crear cuentas de otras
 * personas: el registro público está cerrado a propósito. Solo la clave de
 * servicio puede hacerlo.
 *
 * Resguardos:
 *  · Este módulo es solo del servidor ('server-only'): la clave nunca llega al navegador.
 *  · La clave se lee aquí, en el momento, y solo se usa para invitar.
 *  · Antes de usarla se verifica que quien invita es Superadmin con su rol
 *    vigente en la base (sesión con doble factor, factor anterior al rol).
 *  · Los roles NO se asignan con esta clave: se asignan después con la sesión
 *    de quien invita, así RLS y las reglas de la base los validan igual que siempre.
 */
export type ResultadoInvitar = { ok: true; userId: string } | { ok: false; error: string };

function claveDeServicio(): string | null {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) return null;
  if (clave.startsWith('sb_secret_')) return clave;
  try {
    const rol = JSON.parse(Buffer.from(clave.split('.')[1] ?? '', 'base64url').toString('utf8')).role;
    return rol === 'service_role' ? clave : null;
  } catch {
    return null;
  }
}

export async function invitarConServicio(correo: string, nombre: string, redirigirA: string): Promise<ResultadoInvitar> {
  const acceso = await obtenerAcceso();
  if (!acceso || acceso.nivel !== 'aal2' || !acceso.efectivos.includes('superadmin')) {
    return { ok: false, error: 'Solo un Superadministrador con doble factor puede invitar.' };
  }
  const url = process.env.SUPABASE_URL;
  const clave = claveDeServicio();
  if (!url || !clave) return { ok: false, error: 'El servidor no tiene configurada la clave para invitar (SUPABASE_SERVICE_ROLE_KEY). Ver app/README.md.' };

  const admin = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await admin.auth.admin.inviteUserByEmail(correo, { data: { nombre }, redirectTo: redirigirA });
  if (error || !data.user) {
    if (error?.status === 422 || /already/i.test(error?.message ?? '')) return { ok: false, error: 'Ese correo ya tiene una cuenta. Búscalo en la lista.' };
    if (error?.status === 429) return { ok: false, error: 'Se enviaron demasiados correos seguidos. Espera un rato y vuelve a intentar.' };
    return { ok: false, error: 'No se pudo enviar la invitación.' };
  }
  return { ok: true, userId: data.user.id };
}
