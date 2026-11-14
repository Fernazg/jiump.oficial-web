'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { EstadoFormulario } from '@/components/admin/Formulario';
import { obtenerAcceso } from './acceso';
import { destinoSeguro } from './secciones';
import { clientePanel } from './supabase-panel';

const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();

// -----------------------------------------------------------------------------
// Ingresar (correo + contraseña). No hay registro público.
// -----------------------------------------------------------------------------
export async function ingresar(_: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const correo = texto(datos, 'correo');
  const clave = String(datos.get('clave') ?? '');
  if (!correo || !clave) return { error: 'Escribe tu correo y tu contraseña.' };

  const supabase = await clientePanel();
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
  if (error) {
    if (/banned/i.test(error.message) || error.code === 'user_banned') {
      return { error: 'Tu acceso al panel está desactivado. Habla con un superadministrador.' };
    }
    if (error.status === 429) return { error: 'Demasiados intentos. Espera unos minutos y vuelve a probar.' };
    return { error: 'El correo o la contraseña no son correctos.' };
  }
  redirect(await pasoSiguiente(destinoSeguro(datos.get('siguiente'))));
}

/**
 * Después de ingresar: pedir el código si tiene doble factor, exigir que lo
 * inscriba si es superadmin y no lo tiene, o seguir al destino. (El proxy y
 * las páginas lo vuelven a comprobar en cada paso.)
 */
async function pasoSiguiente(destino: string): Promise<string> {
  const supabase = await clientePanel();
  const [{ data: nivel }, { data: acceso }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.rpc('mi_acceso'),
  ]);
  if (nivel?.nextLevel === 'aal2' && nivel.currentLevel !== 'aal2') {
    return destino === '/admin' ? '/admin/verificar' : `/admin/verificar?siguiente=${encodeURIComponent(destino)}`;
  }
  if (((acceso?.roles ?? []) as string[]).includes('superadmin') && nivel?.nextLevel !== 'aal2') return '/admin/doble-factor';
  return destino;
}

// -----------------------------------------------------------------------------
// Doble factor: verificar el código de la app autenticadora
// -----------------------------------------------------------------------------
const MENSAJE_CODIGO = 'El código no es correcto o ya venció. Revisa que la hora del teléfono esté al día y escribe el código nuevo.';

export async function verificarCodigo(_: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const codigo = texto(datos, 'codigo').replace(/\s/g, '');
  if (!/^\d{6}$/.test(codigo)) return { error: 'El código tiene 6 números.' };
  const supabase = await clientePanel();
  const { data: factores } = await supabase.auth.mfa.listFactors();
  const factor = factores?.totp?.[0];
  if (!factor) redirect('/admin');
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: codigo });
  if (error) return { error: MENSAJE_CODIGO };
  redirect(destinoSeguro(datos.get('siguiente')));
}

/** Inscribe un factor TOTP nuevo (quita antes los que quedaron sin verificar). */
export async function prepararFactor(): Promise<{ id: string; qr: string; secreto: string } | { error: string }> {
  const supabase = await clientePanel();
  const { data: lista } = await supabase.auth.mfa.listFactors();
  for (const f of lista?.all ?? []) {
    if (f.factor_type === 'totp' && f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    issuer: 'JIUMP Panel',
    friendlyName: `App autenticadora ${new Date().toISOString().slice(0, 16)}`,
  });
  if (error || !data) return { error: 'No se pudo preparar el doble factor. Recarga la página para intentarlo de nuevo.' };
  return { id: data.id, qr: data.totp.qr_code, secreto: data.totp.secret };
}

export async function confirmarFactor(_: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const codigo = texto(datos, 'codigo').replace(/\s/g, '');
  const factorId = texto(datos, 'factor');
  if (!/^\d{6}$/.test(codigo)) return { error: 'El código tiene 6 números.' };
  const supabase = await clientePanel();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: codigo });
  if (error) return { error: MENSAJE_CODIGO };
  redirect('/admin/cuenta?doble-factor=activado');
}

/** Quitar el doble factor (solo quien no es superadmin; exige sesión verificada). */
export async function quitarFactor(): Promise<EstadoFormulario> {
  const acceso = await obtenerAcceso();
  if (!acceso || acceso.debeVerificar) redirect('/admin/ingresar');
  if (acceso.roles.includes('superadmin')) return { error: 'Para Superadministrador el doble factor es obligatorio.' };
  const supabase = await clientePanel();
  const { data } = await supabase.auth.mfa.listFactors();
  for (const f of data?.totp ?? []) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (error) return { error: 'No se pudo quitar el doble factor. Vuelve a iniciar sesión e inténtalo otra vez.' };
  }
  redirect('/admin/cuenta?doble-factor=quitado');
}

// -----------------------------------------------------------------------------
// Recuperar la contraseña
// -----------------------------------------------------------------------------
async function origen(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function recuperar(_: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const correo = texto(datos, 'correo');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return { error: 'Escribe un correo válido.' };
  const supabase = await clientePanel();
  // Supabase solo acepta destinos de su lista de URL permitidas.
  await supabase.auth.resetPasswordForEmail(correo, {
    redirectTo: `${await origen()}/admin/auth/confirmar?siguiente=/admin/nueva-clave`,
  });
  // Mismo mensaje exista o no la cuenta (no revela qué correos tienen acceso).
  redirect('/admin/recuperar?enviado=1');
}

export async function nuevaClave(_: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const clave = String(datos.get('clave') ?? '');
  const repetir = String(datos.get('repetir') ?? '');
  if (clave.length < 10) return { error: 'La contraseña debe tener al menos 10 caracteres.' };
  if (clave !== repetir) return { error: 'Las dos contraseñas no coinciden.' };
  const acceso = await obtenerAcceso();
  if (!acceso) redirect('/admin/ingresar?motivo=enlace');
  const supabase = await clientePanel();
  const { error } = await supabase.auth.updateUser({ password: clave });
  if (error) {
    if (/different|same/i.test(error.message)) return { error: 'La contraseña nueva debe ser distinta de la anterior.' };
    if (/weak|short|length/i.test(error.message)) return { error: 'Esa contraseña es muy débil. Usa una más larga o con más variedad.' };
    return { error: 'No se pudo guardar la contraseña. Pide un enlace nuevo e inténtalo otra vez.' };
  }
  redirect('/admin?clave=actualizada');
}
