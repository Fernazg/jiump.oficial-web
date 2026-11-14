import type { Metadata } from 'next';
import { AvisoVistaPrevia } from '@/components/AvisoVistaPrevia';
import { exigirPagina } from '@/lib/paginas';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Flecha, Foto, Pastilla } from '@/components/Basicos';
import { Bloques } from '@/components/Bloques';
import { IconoCalendario, IconoUbicacion, IconoVideo } from '@/components/Iconos';
import { GaleriaFotos } from '@/components/Visor';
import { TarjetaActividad } from '@/components/Tarjetas';
import { actividadPorSlug, actividades, detalleActividad, firmarFotos, fotosDeBloques } from '@/lib/datos';
import { etiquetaActividad, fechaActividad, idYoutube } from '@/lib/formato';
import type { FotoFirmada } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await actividadPorSlug((await params).slug);
  return { title: a ? a.titulo : 'Actividad no encontrada' };
}

export default async function PaginaActividad({ params }: Props) {
  const { vistaPrevia } = await exigirPagina('eventos');
  const actividad = await actividadPorSlug((await params).slug);
  if (!actividad) notFound();

  const [d, todas] = await Promise.all([detalleActividad(actividad.id), actividades()]);
  const otras = todas.filter((a) => a.anio === actividad.anio && a.id !== actividad.id).slice(0, 3);
  const fotos = await firmarFotos([
    actividad.portada_foto_id, ...d.fotoIds, ...d.secciones.flatMap((s) => fotosDeBloques(s.contenido)), ...otras.map((a) => a.portada_foto_id),
  ]);
  const portada = fotos.get(actividad.portada_foto_id ?? '');
  const galeria = d.fotoIds.map((id) => fotos.get(id)).filter((f): f is FotoFirmada => Boolean(f));
  const videos = [
    ...d.videos.map((v) => ({ id: v.id, titulo: v.titulo, url: v.url })),
    ...d.enlaces.map((e) => ({ id: e.id, titulo: e.titulo, url: e.url })),
  ];
  const fecha = fechaActividad(actividad);
  const album = d.albumes[0];

  return (
    <>
      <AvisoVistaPrevia activo={vistaPrevia} />
      <section className="relative isolate overflow-hidden bg-azul-profundo text-white">
        {portada && <Foto foto={portada} prioridad className="absolute inset-0 -z-10 size-full object-cover" tamanos="100vw" />}
        <div className="velo absolute inset-0 -z-10" />
        <div className="contenedor flex min-h-[480px] flex-col justify-end pb-14 pt-24">
          <nav aria-label="Ruta" className="t-meta font-normal text-white/85">
            <Link href="/eventos" className="underline underline-offset-2">Eventos</Link> / {actividad.titulo}
          </nav>
          {actividad.lema ? (
            // Diseño: el nombre como etiqueta con línea turquesa y el lema como titular
            <>
              <p className="t-etiqueta mt-5 flex items-center gap-3 text-turquesa-claro" data-nombre-actividad>
                <span aria-hidden className="franja-corta !w-14" />{actividad.titulo}
              </p>
              <h1 className="t-display mt-3 max-w-[16ch]">{actividad.lema}</h1>
            </>
          ) : (
            <>
              <div className="mt-5"><Pastilla>{etiquetaActividad(actividad)}</Pastilla></div>
              <h1 className="t-h1 mt-4 max-w-[20ch]">{actividad.titulo}</h1>
            </>
          )}
          {(fecha || actividad.lugar || actividad.cita_referencia) && (
            <ul className="t-meta mt-5 flex flex-wrap gap-x-6 gap-y-2 font-normal text-white/90">
              {fecha && <li className="flex items-center gap-2"><IconoCalendario tam={18} /><span><strong>Fecha:</strong> {fecha}</span></li>}
              {actividad.lugar && <li className="flex items-center gap-2"><IconoUbicacion tam={18} />{actividad.lugar}</li>}
              {actividad.cita_referencia && <li data-cita-referencia><strong>Cita:</strong> {actividad.cita_referencia}</li>}
            </ul>
          )}
        </div>
      </section>

      {(actividad.introduccion || actividad.cita_texto) && (
        <section className="contenedor grid gap-8 py-14 lg:grid-cols-[1.3fr_1fr] lg:items-start">
          {actividad.introduccion && <p className="t-entradilla medida whitespace-pre-line">{actividad.introduccion}</p>}
          {actividad.cita_texto && actividad.cita_referencia && (
            <figure className="rounded-2xl border-l-4 border-azul bg-azul-claro px-6 py-6" data-cita>
              <blockquote className="font-titulo text-[20px] font-semibold leading-snug text-azul-profundo">“{actividad.cita_texto}”</blockquote>
              <figcaption className="t-meta mt-3 text-azul-oscuro">{actividad.cita_referencia}</figcaption>
            </figure>
          )}
        </section>
      )}

      {d.secciones.length > 0 && (
        <section className="contenedor grid gap-6 pb-14 lg:grid-cols-2">
          {d.secciones.map((s) => (
            <article key={s.id} className="tarjeta p-7">
              <h2 className="t-h3">{s.titulo}</h2>
              {Array.isArray(s.contenido) && s.contenido.length > 0 && (
                <div className="mt-4"><Bloques bloques={s.contenido} fotos={fotos} /></div>
              )}
            </article>
          ))}
        </section>
      )}

      {galeria.length > 0 && (
        <section className="bg-gris-claro py-16" data-seccion="fotos">
          <div className="contenedor">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="t-h2">Fotos</h2>
              {album && <Link href={`/galeria/${album.slug}`} className="enlace">Ver el álbum <Flecha /></Link>}
            </div>
            <div className="mt-8"><GaleriaFotos fotos={galeria} /></div>
          </div>
        </section>
      )}

      {/* Si la actividad no tiene videos ni enlaces, la sección se oculta (diseño) */}
      {videos.length > 0 && (
        <section className="contenedor py-16" data-seccion="videos">
          <h2 className="t-h2">Videos y transmisiones</h2>
          <ul className="mt-8 grid gap-6 lg:grid-cols-2">
            {videos.map((v) => {
              const id = idYoutube(v.url);
              return (
                <li key={v.id}>
                  {id ? (
                    <div className="aspect-video overflow-hidden rounded-[18px] bg-azul-profundo">
                      <iframe className="size-full" src={`https://www.youtube-nocookie.com/embed/${id}`} title={v.titulo} loading="lazy"
                        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                    </div>
                  ) : (
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className="tarjeta flex items-center gap-3 p-5 text-azul">
                      <IconoVideo /> <span className="font-semibold">{v.titulo}</span>
                    </a>
                  )}
                  {id && <p className="t-meta mt-3">{v.titulo}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {otras.length > 0 && (
        <section className="contenedor py-16" data-seccion="otras-actividades">
          <h2 className="t-h2">Otras actividades {actividad.anio}</h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {otras.map((a) => (
              <li key={a.id}><TarjetaActividad actividad={a} foto={fotos.get(a.portada_foto_id ?? '')} alto="h-[300px]" /></li>
            ))}
          </ul>
        </section>
      )}

      <section className="contenedor pb-20 pt-6">
        <Link href="/eventos" className="enlace">← Volver a eventos</Link>
      </section>
    </>
  );
}
