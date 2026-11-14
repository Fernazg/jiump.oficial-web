import Link from 'next/link';
import { VistaAlbum } from '@/components/VistaAlbum';
import { idYoutube } from '@/lib/formato';
import type { Actividad, Album, FotoFirmada, Video } from '@/lib/tipos';

/**
 * Dirección propia de un álbum: la «Vista de álbum» de Galería y sus videos.
 * La usan el sitio público y la vista previa del panel /admin.
 */
export function AlbumCompleto({ album, fotos, videos, actividad }: {
  album: Album & { fotoIds: string[] };
  fotos: Map<string, FotoFirmada>;
  videos: Video[];
  actividad: Actividad | undefined;
}) {
  return (
    <>
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
