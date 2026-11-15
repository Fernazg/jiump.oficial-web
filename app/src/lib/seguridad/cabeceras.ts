/**
 * Cabeceras de seguridad del sitio y del panel.
 *
 * Este archivo no importa nada del servidor: lo usan `next.config.ts`
 * (cabeceras fijas, en todas las respuestas) y `proxy.ts` (la política de
 * contenido, que lleva un valor distinto en cada visita).
 */

/** Cabeceras iguales para todas las respuestas (páginas, fotos de marca, archivos estáticos). */
export function cabecerasFijas(produccion: boolean): { key: string; value: string }[] {
  return [
    // El navegador respeta el tipo declarado: un archivo subido nunca se ejecuta como script.
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    // Nadie puede mostrar el sitio ni el panel dentro de un marco (evita el «clickjacking»).
    { key: 'X-Frame-Options', value: 'DENY' },
    // Al salir del sitio solo se informa el dominio, nunca la dirección completa (que en el panel trae identificadores).
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // El sitio no usa cámara, micrófono, ubicación ni pagos: quedan bloqueados también para contenido incrustado.
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    // Solo HTTPS durante un año. Sin «includeSubDomains»: jiump.cl puede tener otros subdominios que no controla este sitio.
    ...(produccion ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : []),
  ];
}

/** Valor único por visita: solo los scripts que lo llevan pueden ejecutarse. */
export function nuevoNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Política de seguridad de contenido (CSP).
 *  · Scripts: solo los del propio sitio marcados con el valor de esta visita.
 *    Un script inyectado (por ejemplo, en un texto) no se ejecuta.
 *  · Fotos: del propio sitio y del almacenamiento de Supabase (URL firmadas).
 *  · Videos: solo YouTube en su versión sin cookies.
 *  · Nadie puede enmarcar el sitio, y los formularios solo envían al propio sitio.
 * El panel además necesita WebAssembly (optimiza las fotos en el navegador) y
 * mostrar las fotos recién elegidas (blob:) y el código QR del doble factor (data:).
 */
export function politicaContenido({ nonce, panel, supabaseUrl, desarrollo = false }: {
  nonce: string; panel: boolean; supabaseUrl?: string; desarrollo?: boolean;
}): string {
  let almacenamiento = '';
  try { if (supabaseUrl) almacenamiento = new URL(supabaseUrl).origin; } catch { /* sin Supabase configurado */ }
  const reglas: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(panel ? ["'wasm-unsafe-eval'"] : []), ...(desarrollo ? ["'unsafe-eval'"] : [])],
    // React escribe estilos en atributos (style="…"); no hay forma de marcarlos uno a uno.
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", ...(almacenamiento ? [almacenamiento] : []), ...(panel ? ['blob:', 'data:'] : [])],
    'font-src': ["'self'"],
    'connect-src': ["'self'", ...(desarrollo ? ['ws:'] : [])],
    'frame-src': ['https://www.youtube-nocookie.com'],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'manifest-src': ["'self'"],
  };
  return Object.entries(reglas).map(([k, v]) => `${k} ${v.join(' ')}`).join('; ');
}
