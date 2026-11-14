import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticuloCompleto } from '@/components/ArticuloCompleto';
import { AvisoVistaPrevia } from '@/components/AvisoVistaPrevia';
import { articuloPorSlug, articulos, firmarFotos, fotosDeBloques, series } from '@/lib/datos';
import { exigirPagina } from '@/lib/paginas';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await articuloPorSlug((await params).slug);
  return a ? { title: a.titulo, description: a.bajada ?? undefined } : { title: 'Artículo no encontrado' };
}

export default async function PaginaArticulo({ params }: Props) {
  const { vistaPrevia } = await exigirPagina('articulos');
  const articulo = await articuloPorSlug((await params).slug);
  if (!articulo) notFound(); // no existe o no está publicado (RLS)

  const [listaSeries, todos] = await Promise.all([series(), articulos()]);
  const serie = listaSeries.find((s) => s.id === articulo.serie_id);
  const hermanos = serie ? todos.filter((a) => a.serie_id === serie.id).sort((a, b) => (a.parte ?? 0) - (b.parte ?? 0)) : [];
  const cuerpo = Array.isArray(articulo.cuerpo) ? articulo.cuerpo : [];
  const fotos = await firmarFotos([articulo.portada_foto_id, ...fotosDeBloques(cuerpo)]);

  return (
    <>
      <AvisoVistaPrevia activo={vistaPrevia} />
      <ArticuloCompleto articulo={articulo} serie={serie} hermanos={hermanos} fotos={fotos} />
    </>
  );
}
