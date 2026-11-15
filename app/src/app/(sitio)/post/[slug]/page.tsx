import { notFound, permanentRedirect } from 'next/navigation';
import { articuloPorSlug } from '@/lib/datos';

export const dynamic = 'force-dynamic';

/**
 * Direcciones antiguas del blog de Wix (jiump.cl/post/<nombre>): si existe un
 * artículo publicado con ese mismo nombre, redirige de forma permanente a su
 * dirección nueva. Si el nombre cambió al migrar, se agrega una redirección en
 * el panel (Configuración › Redirecciones), que tiene prioridad sobre esta regla.
 */
export default async function PostDeWix({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const articulo = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ? await articuloPorSlug(slug) : null;
  if (!articulo) notFound();
  permanentRedirect(`/articulos/${articulo.slug}`);
}
