import Link from '@/components/Enlace';
import { VistaAlbum } from '@/components/VistaAlbum';
import { idYoutube } from '@/lib/formato';
import { VideoDiferido } from '@/components/VideoDiferido';
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
                  <VideoDiferido youtubeId={id} titulo={v.titulo} portada={fotos.get(v.portada_foto_id ?? '')} />
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
