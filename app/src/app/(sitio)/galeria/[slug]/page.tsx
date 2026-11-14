import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AvisoVistaPrevia } from '@/components/AvisoVistaPrevia';
import { VistaAlbum } from '@/components/VistaAlbum';
import { actividades, albumes, firmarFotos, videosDeAlbum } from '@/lib/datos';
import { idYoutube } from '@/lib/formato';
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
      <div className="contenedor pt-10">
        <nav aria-label="Ruta" className="t-meta font-normal text-texto-2">
          <Link href="/galeria" className="underline underline-offset-2">Galería</Link> / {album.titulo}
        </nav>
      </div>
      <VistaAlbum album={album} fotos={fotos} actividad={actividad} titulo="h1" compartir={false} />

      {videos.some((v) => idYoutube(v.url)) && (
        <section className="contenedor pb-10">
          <ul className="grid gap-6 lg:grid-cols-2">
            {videos.map((v) => {
              const id = idYoutube(v.url);
              return id ? (
                <li key={v.id}>
                  <div className="aspect-video overflow-hidden rounded-[18px] bg-azul-profundo">
                    <iframe className="size-full" src={`https://www.youtube-nocookie.com/embed/${id}`} title={v.titulo} loading="lazy"
                      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  </div>
                  <p className="t-meta mt-3">{v.titulo}</p>
                </li>
              ) : null;
            })}
          </ul>
        </section>
      )}

      <div className="contenedor pb-20">
        <Link href="/galeria" className="enlace">← Ver todos los álbumes</Link>
      </div>
    </>
  );
}
