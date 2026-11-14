import Link from 'next/link';
import type { Actividad, Album, FotoFirmada } from '@/lib/tipos';
import { EstadoVacio, Etiqueta, Flecha } from './Basicos';
import { IconoImagen } from './Iconos';
import { GaleriaFotos } from './Visor';

/**
 * «Vista de álbum» del diseño de Galería: etiqueta, título, cantidad de fotos,
 * enlace al evento y las fotos en mosaico con visor. Se usa dentro de Galería
 * y en la dirección propia del álbum (para compartir), con el mismo aspecto.
 */
export function VistaAlbum({ album, fotos, actividad, fondo = 'blanco', titulo = 'h2', compartir = true }: {
  album: Album & { fotoIds: string[] };
  fotos: Map<string, FotoFirmada>;
  actividad?: Actividad;
  fondo?: 'blanco' | 'gris';
  titulo?: 'h1' | 'h2';
  compartir?: boolean;
}) {
  const lista = album.fotoIds.map((id) => fotos.get(id)).filter((f): f is FotoFirmada => Boolean(f));
  const lugar = [album.ciudad, album.pais].filter(Boolean).join(', ');
  const Titulo = titulo;
  return (
    <section id={`album-${album.slug}`} data-vista-album={album.slug}
      className={`scroll-mt-24 border-t border-linea py-16 ${fondo === 'gris' ? 'bg-gris-claro' : 'bg-white'}`}>
      <div className="contenedor">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Etiqueta>{['Vista de álbum', album.pais].filter(Boolean).join(' · ')}</Etiqueta>
            <Titulo className="t-h2 mt-3">{album.titulo}</Titulo>
            {(album.anio || lugar) && <p className="t-meta mt-2 font-normal text-texto-2">{[album.anio, lugar].filter(Boolean).join(' · ')}</p>}
            {album.descripcion && <p className="medida mt-3 text-texto-2">{album.descripcion}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {lista.length > 0 && <span className="t-meta text-texto-2">{lista.length} {lista.length === 1 ? 'foto' : 'fotos'}</span>}
            {actividad && <Link href={`/eventos/${actividad.slug}`} className="enlace">Ver el evento <Flecha /></Link>}
            {compartir && <Link href={`/galeria/${album.slug}`} className="enlace" data-enlace-album>Enlace del álbum</Link>}
          </div>
        </div>
        <div className="mt-8">
          {lista.length > 0 ? (
            <GaleriaFotos fotos={lista} diseno="mosaico" />
          ) : (
            <EstadoVacio compacto icono={<IconoImagen />} titulo="Fotos próximamente">
              Este álbum se completará cuando el equipo de Multimedia suba las fotos del encuentro.
            </EstadoVacio>
          )}
        </div>
      </div>
    </section>
  );
}
