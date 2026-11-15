'use server';

import { clientePanel } from './supabase-panel';

/**
 * Invitación aceptada: Supabase devuelve la sesión en el enlace (después de
 * «#», que solo ve el navegador). El navegador la entrega aquí y el servidor
 * la guarda en cookies httpOnly; Supabase valida los tokens.
 */
export async function aceptarInvitacion(accessToken: string, refreshToken: string): Promise<{ ok: boolean }> {
  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string' || accessToken.length > 4096 || refreshToken.length > 512) return { ok: false };
  const supabase = await clientePanel();
  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  return { ok: !error };
}
