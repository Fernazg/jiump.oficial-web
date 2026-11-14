import Link from 'next/link';
import { dosDigitos, etiquetaActividad, recortar } from '@/lib/formato';
import type { Actividad, Album, Articulo, FotoFirmada, Serie } from '@/lib/tipos';
import { Flecha, Foto, Pastilla } from './Basicos';
import { IconoImagen } from './Iconos';

/** Tarjeta de actividad sobre su foto de portada, con velo azul profundo. */
export function TarjetaActividad({ actividad, foto, alto = 'h-[440px]', grande = false }: {
  actividad: Actividad; foto?: FotoFirmada; alto?: string; grande?: boolean;
}) {
  return (
    <Link href={`/eventos/${actividad.slug}`} data-actividad={actividad.slug}
      className={`levantar group relative flex ${alto} flex-col justify-end overflow-hidden rounded-[22px] bg-azul-profundo text-white shadow-[var(--shadow-tarjeta)]`}>
      {foto && <Foto foto={foto} className="absolute inset-0 size-full object-cover" tamanos="(max-width: 640px) 90vw, 50vw" />}
      <div className="velo absolute inset-0" />
      <div className="relative p-6 sm:p-7">
        {/* Con lema (diseño): la etiqueta lleva el nombre y el título es el lema «Heme aquí» */}
        <Pastilla>{actividad.lema ? actividad.titulo : etiquetaActividad(actividad)}</Pastilla>
        <h3 className={`mt-3 font-titulo font-bold leading-tight ${grande ? 'text-[26px] sm:text-[32px]' : 'text-[22px] sm:text-[26px]'}`}>
          {actividad.lema ? `«${actividad.lema}»` : actividad.titulo}
        </h3>
        {actividad.introduccion && <p className="mt-2 line-clamp-2 text-[15px] text-white/85">{recortar(actividad.introduccion, 180)}</p>}
        <span className="mt-3 inline-flex items-center gap-1 font-ui text-[14px] font-semibold">Ver actividad <Flecha /></span>
      </div>
    </Link>
  );
}

/** Miniatura numerada de una parte de serie (azul Palabra o rojo antorcha). */
export function NumeroParte({ parte, color, tam = 'chico' }: { parte: number | null; color: Serie['color']; tam?: 'chico' | 'grande' }) {
  const fondo = color === 'rojo' ? 'bg-rojo' : color === 'neutro' ? 'bg-azul-profundo' : 'bg-azul';
  const tamano = tam === 'grande' ? 'h-[150px] text-[96px]' : 'size-[72px] text-[40px] shrink-0';
  return (
    <span aria-hidden className={`relative grid ${tamano} place-items-end overflow-hidden rounded-2xl ${fondo} p-2 font-titulo font-extrabold leading-none text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,0.75)]`}>
      {dosDigitos(parte)}
    </span>
  );
}

/** Fila de artículo: número de la parte + serie + título. */
export function FilaArticulo({ articulo, serie, total }: { articulo: Articulo; serie?: Serie; total?: number }) {
  const color = serie?.color ?? 'azul';
  return (
    <Link href={`/articulos/${articulo.slug}`} data-articulo={articulo.slug} className="group flex items-center gap-4 py-4">
      <NumeroParte parte={articulo.parte} color={color} />
      <span>
        {serie && (
          <span className={`t-meta block ${color === 'rojo' ? 'text-rojo-oscuro' : 'text-azul-oscuro'}`}>
            {serie.nombre}{articulo.parte ? ` · Parte ${articulo.parte}${total ? ` de ${total}` : ''}` : ''}
          </span>
        )}
        <span className="font-titulo text-[19px] font-bold leading-snug group-hover:text-azul sm:text-[20px]">{articulo.titulo}</span>
      </span>
    </Link>
  );
}

/** Tarjeta de álbum: portada + tres miniaturas, o «Fotos próximamente». */
export function TarjetaAlbum({ album, fotos, href }: { album: Album & { fotoIds: string[] }; fotos: Map<string, FotoFirmada>; href?: string }) {
  const ids = album.fotoIds.filter((id) => fotos.has(id));
  const portada = (album.portada_foto_id && fotos.get(album.portada_foto_id)) || (ids[0] ? fotos.get(ids[0]) : undefined);
  const resto = ids.filter((id) => id !== portada?.id).slice(0, 3).map((id) => fotos.get(id)!);
  const n = album.fotoIds.length; // todas las del álbum (aquí solo se firman las del collage)
  return (
    <Link href={href ?? `/galeria/${album.slug}`} data-album={album.slug} className="levantar group block">
      {portada ? (
        <div className="grid gap-1.5 overflow-hidden rounded-[22px]">
          <Foto foto={portada} className="aspect-[16/7] w-full object-cover" tamanos="(max-width: 640px) 90vw, 33vw" />
          {resto.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              {resto.map((f) => <Foto key={f.id} foto={f} className="aspect-[4/3] w-full object-cover" tamanos="11vw" />)}
            </div>
          )}
        </div>
      ) : (
        <div className="grid aspect-[4/3] place-items-center rounded-[22px] bg-gris-claro px-6 text-center">
          <div>
            <IconoImagen className="mx-auto text-azul" tam={32} />
            <p className="mt-3 font-titulo text-[17px] font-bold">Fotos próximamente</p>
          </div>
        </div>
      )}
      <div className="mt-4 flex items-start justify-between gap-4">
        <h3 className="t-h4 group-hover:text-azul">{album.titulo}</h3>
        {n > 0 && <span className="t-meta shrink-0 pt-1 text-texto-2">{n} {n === 1 ? 'foto' : 'fotos'}</span>}
      </div>
    </Link>
  );
}
