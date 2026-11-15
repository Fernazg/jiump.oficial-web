import type { MetadataRoute } from 'next';
import { actividades, albumes, articulos } from '@/lib/datos';
import { paginasPublicadas } from '@/lib/paginas';
import { urlSitio } from '@/lib/seo';

export const dynamic = 'force-dynamic';

/**
 * Mapa del sitio para buscadores (/sitemap.xml). Se arma en cada consulta con
 * la clave anónima: solo aparece lo publicado. Una página retirada sale del
 * mapa junto con todo lo que cuelga de ella.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [base, paginas] = await Promise.all([urlSitio(), paginasPublicadas()]);
  const [arts, acts, albs] = await Promise.all([
    paginas.has('articulos') ? articulos() : [],
    paginas.has('eventos') ? actividades() : [],
    paginas.has('galeria') ? albumes() : [],
  ]);
  const fecha = (iso?: string | null) => (iso ? { lastModified: new Date(iso) } : {});
  const ultima = (lista: { actualizado_en?: string }[]) => fecha(lista.map((x) => x.actualizado_en).filter(Boolean).sort().pop());
  return [
    ...(paginas.has('inicio') ? [{ url: base, priority: 1 }] : []),
    ...(paginas.has('nosotros') ? [{ url: `${base}/nosotros`, priority: 0.8 }] : []),
    ...(paginas.has('eventos') ? [{ url: `${base}/eventos`, priority: 0.8, ...ultima(acts) }] : []),
    ...(paginas.has('articulos') ? [{ url: `${base}/articulos`, priority: 0.8, ...ultima(arts) }] : []),
    ...(paginas.has('galeria') ? [{ url: `${base}/galeria`, priority: 0.6, ...ultima(albs) }] : []),
    ...arts.map((a) => ({ url: `${base}/articulos/${a.slug}`, ...fecha(a.actualizado_en ?? a.publicado_en) })),
    ...acts.map((a) => ({ url: `${base}/eventos/${a.slug}`, ...fecha(a.actualizado_en) })),
    ...albs.map((a) => ({ url: `${base}/galeria/${a.slug}`, ...fecha(a.actualizado_en) })),
  ];
}
