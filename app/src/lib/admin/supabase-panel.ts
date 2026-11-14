import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { leerConfiguracion } from '../supabase';

/**
 * Cliente de Supabase del panel: clave anónima + la sesión de la persona
 * (cookies). Todo lo que hace pasa por RLS con SUS permisos. El panel nunca
 * usa la service role (leerConfiguracion() se niega a arrancar con ella).
 */
export const OPCIONES_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // los navegadores aceptan cookies «secure» en http://localhost
  sameSite: 'lax' as const,
  path: '/',
};

export const clientePanel = cache(async (): Promise<SupabaseClient> => {
  const { url, clave } = leerConfiguracion();
  const almacen = await cookies();
  return createServerClient(url, clave, {
    cookieOptions: OPCIONES_COOKIE,
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) almacen.set(name, value, options);
        } catch {
          // En un componente de servidor no se pueden escribir cookies: el
          // proxy ya renovó la sesión antes de llegar aquí.
        }
      },
    },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
});
