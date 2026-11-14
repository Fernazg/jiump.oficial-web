import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EstadoVacio, Etiqueta, Flecha } from '@/components/Basicos';
import { IconoImagen } from '@/components/Iconos';
import { GaleriaFotos } from '@/components/Visor';
import { actividades, albumes, firmarFotos, videosDeAlbum } from '@/lib/datos';
import { idYoutube } from '@/lib/formato';
import type { FotoFirmada } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = (await albumes()).find((x) => x.slug === slug);
  return { title: a ? a.titulo : 'Álbum no encontrado' };
}

export default async function PaginaAlbum({ params }: Props) {
  const { slug } = await params;
  const todos = await albumes();
  const album = todos.find((a) => a.slug === slug);
  if (!album) notFound();

  const [fotos, videos, acts] = await Promise.all([firmarFotos(album.fotoIds), videosDeAlbum(album.id), actividades()]);
  const lista = album.fotoIds.map((id) => fotos.get(id)).filter((f): f is FotoFirmada => Boolean(f));
  const actividad = acts.find((a) => a.id === album.actividad_id);
  const lugar = [album.ciudad, album.pais].filter(Boolean).join(', ');

  return (
    <section className="contenedor pb-24 pt-16 sm:pt-20">
      <nav aria-label="Ruta" className="t-meta font-normal text-texto-2">
        <Link href="/galeria" className="underline underline-offset-2">Galería</Link> / {album.titulo}
      </nav>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Etiqueta>{['Vista de álbum', album.pais].filter(Boolean).join(' · ')}</Etiqueta>
          <h1 className="t-h1 mt-3 max-w-[20ch]">{album.titulo}</h1>
          {(album.anio || lugar) && <p className="t-meta mt-3 font-normal text-texto-2">{[album.anio, lugar].filter(Boolean).join(' · ')}</p>}
          {album.descripcion && <p className="medida mt-4 text-texto-2">{album.descripcion}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          {lista.length > 0 && <span className="t-meta text-texto-2">{lista.length} {lista.length === 1 ? 'foto' : 'fotos'}</span>}
          {actividad && <Link href={`/eventos/${actividad.slug}`} className="enlace">Ver el evento <Flecha /></Link>}
        </div>
      </div>

      <div className="mt-10">
        {lista.length > 0 ? (
          <GaleriaFotos fotos={lista} />
        ) : (
          <EstadoVacio icono={<IconoImagen />} titulo="Fotos próximamente" acciones={[{ texto: 'Ver otros álbumes', href: '/galeria' }]}>
            Este álbum se completará cuando el equipo de Multimedia suba las fotos del encuentro.
          </EstadoVacio>
        )}
      </div>

      {videos.length > 0 && (
        <ul className="mt-14 grid gap-6 lg:grid-cols-2">
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
      )}
    </section>
  );
}
