/**
 * Páginas públicas guardadas ya armadas (Cloudflare Workers, plan gratuito).
 *
 * El plan gratuito permite 10 ms de procesador por visita. Armar una página
 * con Next.js cuesta entre 20 y 35 ms, y solo pasar por Next.js ya cuesta
 * unos 8 ms. Por eso el Worker (cloudflare/worker.ts) atiende las visitas
 * públicas ANTES de Next.js:
 *
 *  1. Pregunta a la base `estado_sitio()` (una consulta): mantenimiento,
 *     redirección y versión del contenido.
 *  2. Si hay mantenimiento o redirección, deja todo a Next.js (proxy.ts), como antes.
 *  3. Si no, busca la página guardada con esa versión en KV. Si está, la
 *     entrega sin armarla. Si no está, la arma Next.js y se guarda.
 *
 * Publicar, editar o retirar cualquier contenido sube la versión (triggers en
 * la base), así que la página guardada deja de usarse al instante.
 *
 * Este archivo no importa nada de Next.js: lo usa el Worker.
 */
import { cabecerasFijas, nuevoNonce, politicaContenido } from './seguridad/cabeceras';

/** HTMLRewriter es parte del motor de Cloudflare (no existe en Node). */
declare const HTMLRewriter: {
  new (): { on(selector: string, h: { element(e: { setAttribute(n: string, v: string): void }): void }): { transform(r: Response): Response } };
};

/** Una página guardada dura como máximo esto. Las fotos firmadas de la página duran más (ver datos.ts). */
export const SEGUNDOS_PAGINA_GUARDADA = 24 * 60 * 60;
/**
 * Parámetros que cambian lo que muestra una página (filtros de Artículos y
 * Galería). Los demás (por ejemplo «?utm_source=») no cambian nada: se ignoran
 * al guardar, para no gastar el límite de escrituras de KV (1.000 al día en el
 * plan gratuito) con direcciones que muestran lo mismo.
 */
const PARAMETROS_QUE_CAMBIAN = ['serie', 'tema', 'filtro'];
/** Las versiones de una página se guardan bajo este prefijo (cambiarlo descarta todo lo guardado). */
const PREFIJO = 'pagina:v1:';

/** Cabecera de diagnóstico: HIT (guardada), MISS (armada y guardada) o BYPASS (no se guarda). */
export const CABECERA_DIAGNOSTICO = 'x-jiump-pagina';

/** Lo mínimo del entorno del Worker que se usa aquí. */
export type EntornoGuardado = {
  /** Identifica cada despliegue del Worker (wrangler.jsonc › version_metadata). */
  CF_VERSION_METADATA?: { id?: string };
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  PAGINAS?: {
    get(clave: string, opciones: { type: 'stream'; cacheTtl?: number }): Promise<ReadableStream | null>;
    getWithMetadata<M>(clave: string, opciones: { type: 'stream'; cacheTtl?: number }): Promise<{ value: ReadableStream | null; metadata: M | null }>;
    put(clave: string, valor: ArrayBuffer | string, opciones: { expirationTtl: number; metadata: unknown }): Promise<void>;
  };
};

type Metadatos = { estado: number; tipo: string; creada: number };

/** Tipos de respuesta que se guardan (páginas, mapa del sitio, robots). */
const TIPOS_GUARDABLES = /^(text\/html|application\/xml|text\/xml|text\/plain)\b/;

/**
 * ¿Esta visita puede atenderse con una página guardada?
 * Solo GET/HEAD públicos y navegaciones completas: nunca el panel, las acciones
 * de formularios, las peticiones internas de Next.js ni los archivos estáticos.
 */
export function esVisitaGuardable(request: Request): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const { pathname } = new URL(request.url);
  if (pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/_next/') || pathname.startsWith('/api/')) return false;
  if (pathname.startsWith('/marca/') || pathname === '/favicon.ico') return false;
  const h = request.headers;
  if (h.has('rsc') || h.has('next-action') || h.has('next-router-prefetch') || h.has('next-router-state-tree')) return false;
  // Búsquedas: cada texto buscado es distinto. Guardarlas gastaría el límite de escrituras de KV.
  if (new URL(request.url).searchParams.has('q')) return false;
  return true;
}

/**
 * Rutas candidatas para buscar una redirección: tal como llegó, decodificada y
 * sin barra final. La misma regla que proxy.ts.
 * Devuelve null si la dirección está mal codificada (la responde Next.js con 400).
 */
export function rutasCandidatas(ruta: string): string[] | null {
  let decodificada: string;
  try { decodificada = decodeURIComponent(ruta); } catch { return null; }
  return [...new Set([ruta, decodificada, decodificada.length > 1 ? decodificada.replace(/\/+$/, '') : decodificada])];
}

type Estado = { mantenimiento: boolean; redireccion: boolean; version: string };

async function estadoSitio(entorno: EntornoGuardado, rutas: string[]): Promise<Estado | null> {
  const url = entorno.SUPABASE_URL;
  const clave = entorno.SUPABASE_ANON_KEY;
  if (!url || !clave) return null;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/estado_sitio`, {
      method: 'POST',
      headers: { apikey: clave, Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_rutas: rutas }),
      signal: AbortSignal.timeout(2500),
    });
    if (!r.ok) return null;
    const e = (await r.json()) as Partial<Estado>;
    if (typeof e.version !== 'string' || !e.version) return null;
    return { mantenimiento: e.mantenimiento === true, redireccion: e.redireccion === true, version: e.version };
  } catch {
    return null;
  }
}

/** Dirección que identifica la página guardada: la ruta y solo los parámetros que la cambian, en orden fijo. */
export function direccionGuardada(url: URL): string {
  const p = new URLSearchParams();
  for (const k of PARAMETROS_QUE_CAMBIAN) { const v = url.searchParams.get(k); if (v !== null) p.set(k, v); }
  const q = p.toString();
  return q ? `${url.pathname}?${q}` : url.pathname;
}

/**
 * La clave lleva el despliegue y la versión del contenido. Sin el despliegue,
 * después de publicar código nuevo se seguirían entregando páginas armadas con
 * el código anterior, que apuntan a archivos de /_next/static que ya no existen.
 */
async function claveDe(despliegue: string, version: string, url: URL): Promise<string> {
  const datos = new TextEncoder().encode(direccionGuardada(url));
  const huella = new Uint8Array(await crypto.subtle.digest('SHA-256', datos));
  return `${PREFIJO}${despliegue}:${version}:${[...huella].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Cabeceras de una página entregada desde lo guardado: las mismas que pone Next.js. */
function cabecerasPagina(tipo: string, nonce: string, entorno: EntornoGuardado): Headers {
  const h = new Headers({ 'Content-Type': tipo, 'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate' });
  for (const { key, value } of cabecerasFijas(true)) h.set(key, value);
  h.set('Content-Security-Policy', politicaContenido({ nonce, panel: false, supabaseUrl: entorno.SUPABASE_URL }));
  h.set(CABECERA_DIAGNOSTICO, 'HIT');
  return h;
}

/**
 * Cada visita lleva un valor nuevo en la política de contenido (CSP). La página
 * guardada trae el valor de cuando se armó en los scripts que puso Next.js:
 * se reemplaza por el nuevo. Solo se tocan las etiquetas que ya lo tenían
 * (las de Next.js), así que un texto del contenido nunca gana permiso para
 * ejecutarse. HTMLRewriter es del motor de Cloudflare: casi no gasta procesador.
 */
function conNonceNuevo(cuerpo: ReadableStream, nonce: string, tipo: string): ReadableStream | Response {
  if (!tipo.startsWith('text/html')) return cuerpo;
  return new HTMLRewriter()
    .on('[nonce]', { element(e) { e.setAttribute('nonce', nonce); } })
    .transform(new Response(cuerpo));
}

/**
 * En mantenimiento, proxy.ts muestra la página de mantenimiento con estado 503,
 * pero el adaptador OpenNext pierde ese estado y responde 200: los buscadores
 * guardarían la página de mantenimiento como si fuera el sitio. Se repone aquí.
 */
function conEstadoMantenimiento(respuesta: Response, ruta: string): Response {
  if (ruta === '/mantenimiento' || respuesta.status !== 200 || !(respuesta.headers.get('content-type') ?? '').startsWith('text/html')) return respuesta;
  const h = new Headers(respuesta.headers);
  h.set('Retry-After', '3600');
  return new Response(respuesta.body, { status: 503, headers: h });
}

type Siguiente = (request: Request) => Promise<Response>;
type Contexto = { waitUntil(p: Promise<unknown>): void };

/**
 * Atiende una visita pública: desde lo guardado si se puede; si no, con Next.js
 * (`siguiente`) y guarda el resultado para las visitas que vienen.
 */
export async function atenderConPaginaGuardada(request: Request, entorno: EntornoGuardado, ctx: Contexto, siguiente: Siguiente): Promise<Response> {
  const kv = entorno.PAGINAS;
  if (!kv || !esVisitaGuardable(request)) return siguiente(request);

  const url = new URL(request.url);
  const rutas = rutasCandidatas(url.pathname);
  if (!rutas) return siguiente(request);
  const estado = await estadoSitio(entorno, rutas);
  // Sin respuesta de la base, mantenimiento o redirección: lo resuelve Next.js (proxy.ts), como siempre.
  if (estado?.mantenimiento) return conEstadoMantenimiento(await siguiente(request), url.pathname);
  if (!estado || estado.redireccion) return siguiente(request);

  const despliegue = entorno.CF_VERSION_METADATA?.id;
  if (!despliegue) return siguiente(request);
  const clave = await claveDe(despliegue, estado.version, url);
  const guardada = await kv.getWithMetadata<Metadatos>(clave, { type: 'stream' }).catch(() => null);
  if (guardada?.value && guardada.metadata && Date.now() - guardada.metadata.creada < SEGUNDOS_PAGINA_GUARDADA * 1000) {
    const { estado: status, tipo } = guardada.metadata;
    const nonce = nuevoNonce();
    const cuerpo = conNonceNuevo(guardada.value, nonce, tipo);
    const headers = cabecerasPagina(tipo, nonce, entorno);
    if (request.method === 'HEAD') {
      ctx.waitUntil((cuerpo instanceof Response ? cuerpo.body! : cuerpo).cancel());
      return new Response(null, { status, headers });
    }
    return new Response(cuerpo instanceof Response ? cuerpo.body : cuerpo, { status, headers });
  }
  if (guardada?.value) ctx.waitUntil(guardada.value.cancel());

  const respuesta = await siguiente(request);
  const tipo = respuesta.headers.get('content-type') ?? '';
  // Solo 200: una dirección inexistente (404) inventada por un robot no debe gastar escrituras de KV.
  const guardable = request.method === 'GET' && respuesta.status === 200
    && TIPOS_GUARDABLES.test(tipo) && !respuesta.headers.has('set-cookie') && respuesta.body;
  if (!guardable) {
    const h = new Headers(respuesta.headers);
    h.set(CABECERA_DIAGNOSTICO, 'BYPASS');
    return new Response(respuesta.body, { status: respuesta.status, statusText: respuesta.statusText, headers: h });
  }
  const [paraVisita, paraGuardar] = respuesta.body!.tee();
  const metadatos: Metadatos = { estado: respuesta.status, tipo, creada: Date.now() };
  ctx.waitUntil(
    new Response(paraGuardar).arrayBuffer()
      .then((cuerpo) => kv.put(clave, cuerpo, { expirationTtl: SEGUNDOS_PAGINA_GUARDADA, metadata: metadatos }))
      .catch(() => { /* si no se pudo guardar, la próxima visita la arma de nuevo */ }),
  );
  const h = new Headers(respuesta.headers);
  h.set(CABECERA_DIAGNOSTICO, 'MISS');
  return new Response(paraVisita, { status: respuesta.status, statusText: respuesta.statusText, headers: h });
}
