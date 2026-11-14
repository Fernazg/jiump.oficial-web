/**
 * Vista previa local: permite ver una página que está en borrador mientras se
 * desarrolla. Solo se activa con las TRES condiciones a la vez:
 *   1. `next dev` (NODE_ENV = development; un build de producción nunca la activa),
 *   2. JIUMP_VISTA_PREVIA=1 en app/.env.local,
 *   3. Supabase local (SUPABASE_URL en 127.0.0.1 o localhost).
 *
 * Solo salta la regla «la página debe estar publicada». Los datos se siguen
 * leyendo con la clave anónima: el contenido en borrador (artículos,
 * actividades, secciones) sigue sin verse. Para previsualizar borradores hará
 * falta el panel /admin con sesión iniciada.
 */
export function vistaPreviaActiva(env: Record<string, string | undefined> = process.env): boolean {
  return (
    env.NODE_ENV === 'development' &&
    env.JIUMP_VISTA_PREVIA === '1' &&
    /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(env.SUPABASE_URL ?? '')
  );
}
