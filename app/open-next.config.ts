import { defineCloudflareConfig } from '@opennextjs/cloudflare';

/**
 * Adaptador OpenNext: convierte el build de Next.js en un Worker de Cloudflare.
 * Configuración mínima, sin servicios adicionales (ni KV, ni R2, ni colas):
 * todo cabe en el plan gratuito de Workers. Ver docs/lanzamiento.md.
 */
export default defineCloudflareConfig({});
