import type { MetadataRoute } from 'next';
import { urlSitio } from '@/lib/seo';

export const dynamic = 'force-dynamic';

/** /robots.txt: todo el sitio es público salvo el panel; apunta al mapa del sitio. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await urlSitio();
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/mantenimiento'] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
