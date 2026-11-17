/**
 * Punto de entrada del Worker de Cloudflare.
 *
 * Las visitas públicas pasan primero por las páginas guardadas
 * (src/lib/paginas-guardadas.ts): si la página ya está armada para la versión
 * actual del contenido, se entrega sin pasar por Next.js (menos de 10 ms de
 * procesador). Todo lo demás (el panel, las acciones, lo que no está guardado)
 * lo atiende Next.js a través del adaptador OpenNext, sin cambios.
 */
// @ts-expect-error: lo genera `opennextjs-cloudflare build` y lo resuelve wrangler.
import openNext from '../.open-next/worker.js';
import { atenderConPaginaGuardada, type EntornoGuardado } from '../src/lib/paginas-guardadas';

type Contexto = { waitUntil(p: Promise<unknown>): void; passThroughOnException(): void };
type ManejadorOpenNext = { fetch(request: Request, env: unknown, ctx: Contexto): Promise<Response> };

const nextjs = openNext as ManejadorOpenNext;

export default {
  async fetch(request: Request, env: EntornoGuardado, ctx: Contexto): Promise<Response> {
    return atenderConPaginaGuardada(request, env, ctx, (r) => nextjs.fetch(r, env, ctx));
  },
};
