import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticuloCompleto } from '@/components/ArticuloCompleto';
import { AvisoVistaPrevia } from '@/components/AvisoVistaPrevia';
import { articuloPorSlug, articulos, firmarFotos, fotosDeBloques, series } from '@/lib/datos';
import { exigirPagina } from '@/lib/paginas';
import { fotoParaCompartir, metadatos, NOMBRE_SITIO, resumenDeBloques, sinVacios, urlSitio } from '@/lib/seo';
import { DatosEstructurados } from '@/components/DatosEstructurados';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await articuloPorSlug((await params).slug);
  if (!a) return { title: 'Artículo no encontrado', robots: { index: false } };
  return metadatos({
    titulo: a.titulo,
    // Sin bajada, la descripción es el comienzo del propio artículo.
    descripcion: a.bajada || resumenDeBloques(a.cuerpo),
    ruta: `/articulos/${a.slug}`,
    foto: await fotoParaCompartir(a.portada_foto_id),
    tipo: 'article',
    publicado: a.publicado_en,
  });
}

export default async function PaginaArticulo({ params }: Props) {
  const { vistaPrevia } = await exigirPagina('articulos');
  const articulo = await articuloPorSlug((await params).slug);
  if (!articulo) notFound(); // no existe o no está publicado (RLS)

  const [listaSeries, todos] = await Promise.all([series(), articulos()]);
  const serie = listaSeries.find((s) => s.id === articulo.serie_id);
  const hermanos = serie ? todos.filter((a) => a.serie_id === serie.id).sort((a, b) => (a.parte ?? 0) - (b.parte ?? 0)) : [];
  const cuerpo = Array.isArray(articulo.cuerpo) ? articulo.cuerpo : [];
  const [fotos, base] = await Promise.all([firmarFotos([articulo.portada_foto_id, ...fotosDeBloques(cuerpo)]), urlSitio()]);
  const portada = fotos.get(articulo.portada_foto_id ?? '');

  return (
    <>
      <AvisoVistaPrevia activo={vistaPrevia} />
      <DatosEstructurados datos={sinVacios({
        '@type': 'Article',
        headline: articulo.titulo,
        description: articulo.bajada || resumenDeBloques(cuerpo),
        url: `${base}/articulos/${articulo.slug}`,
        mainEntityOfPage: `${base}/articulos/${articulo.slug}`,
        inLanguage: 'es-CL',
        datePublished: articulo.publicado_en,
        dateModified: articulo.actualizado_en,
        // El autor solo si está en la base; si falta, el artículo es del movimiento.
        author: articulo.autor ? { '@type': 'Person', name: articulo.autor } : { '@type': 'Organization', name: NOMBRE_SITIO, url: base },
        publisher: { '@type': 'Organization', name: NOMBRE_SITIO, url: base, logo: { '@type': 'ImageObject', url: `${base}/marca/logo-jiump.png` } },
        image: portada ? [portada.original ?? portada.url] : undefined,
        articleSection: serie?.nombre,
      })} />
      <ArticuloCompleto articulo={articulo} serie={serie} hermanos={hermanos} fotos={fotos} />
    </>
  );
}
