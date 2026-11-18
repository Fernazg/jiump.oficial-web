import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AlbumCompleto } from '@/components/AlbumCompleto';
import { AvisoVistaPrevia } from '@/components/AvisoVistaPrevia';
import { actividades, albumes, firmarFotos, videosDeAlbum } from '@/lib/datos';
import { exigirPagina } from '@/lib/paginas';
import { fotoParaCompartir, metadatos } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = (await albumes()).find((x) => x.slug === slug);
  if (!a) return { title: 'Álbum no encontrado', robots: { index: false } };
  return metadatos({
    titulo: a.titulo,
    descripcion: a.descripcion,
    ruta: `/galeria/${a.slug}`,
    foto: await fotoParaCompartir(a.portada_foto_id ?? a.fotoIds[0]),
  });
}

/** Dirección propia de un álbum, para compartirlo: la misma «Vista de álbum» de Galería. */
export default async function PaginaAlbum({ params }: Props) {
  const { vistaPrevia } = await exigirPagina('galeria');
  const { slug } = await params;
  const album = (await albumes()).find((a) => a.slug === slug);
  if (!album) notFound();

  const [videos, acts] = await Promise.all([videosDeAlbum(album.id), actividades()]);
  const fotos = await firmarFotos([...album.fotoIds, ...videos.map((v) => v.portada_foto_id)]);
  const actividad = acts.find((a) => a.id === album.actividad_id);

  return (
    <>
      <AvisoVistaPrevia activo={vistaPrevia} />
      <AlbumCompleto album={album} fotos={fotos} videos={videos} actividad={actividad} />
    </>
  );
}
