import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AlbumCompleto } from '@/components/AlbumCompleto';
import { AvisoVistaPrevia } from '@/components/AvisoVistaPrevia';
import { actividades, albumes, firmarFotos, videosDeAlbum } from '@/lib/datos';
import { exigirPagina } from '@/lib/paginas';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = (await albumes()).find((x) => x.slug === slug);
  return { title: a ? a.titulo : 'Álbum no encontrado' };
}

/** Dirección propia de un álbum, para compartirlo: la misma «Vista de álbum» de Galería. */
export default async function PaginaAlbum({ params }: Props) {
  const { vistaPrevia } = await exigirPagina('galeria');
  const { slug } = await params;
  const album = (await albumes()).find((a) => a.slug === slug);
  if (!album) notFound();

  const [fotos, videos, acts] = await Promise.all([firmarFotos(album.fotoIds), videosDeAlbum(album.id), actividades()]);
  const actividad = acts.find((a) => a.id === album.actividad_id);

  return (
    <>
      <AvisoVistaPrevia activo={vistaPrevia} />
      <AlbumCompleto album={album} fotos={fotos} videos={videos} actividad={actividad} />
    </>
  );
}
