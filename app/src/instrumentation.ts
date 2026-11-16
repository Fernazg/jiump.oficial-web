/**
 * Registro de errores del servidor, sin servicios externos.
 *
 * Next.js llama a `onRequestError` cada vez que una página, una acción del
 * panel o una ruta falla en el servidor. Aquí se deja UNA línea en formato JSON
 * en el registro del alojamiento (Cloudflare o Vercel lo guardan y permiten
 * buscar en él). El campo `digest` es el mismo «Código para soporte» que ve la
 * persona en el aviso de error: con ese código se encuentra la línea exacta.
 *
 * No se registran datos personales: ni cookies, ni cabeceras, ni el contenido
 * de los formularios. De la dirección se guarda solo la ruta, sin parámetros.
 */
type ErrorConDigest = Error & { digest?: string };

export function onRequestError(
  error: unknown,
  peticion: { path: string; method: string },
  contexto: { routePath?: string; routeType?: string },
): void {
  const e = error as ErrorConDigest;
  console.error(JSON.stringify({
    nivel: 'error',
    origen: 'jiump-sitio',
    fecha: new Date().toISOString(),
    digest: e?.digest ?? null,
    mensaje: String(e?.message ?? error).slice(0, 500),
    metodo: peticion.method,
    ruta: peticion.path.split('?')[0],
    pagina: contexto.routePath ?? null,
    tipo: contexto.routeType ?? null,
  }));
}
