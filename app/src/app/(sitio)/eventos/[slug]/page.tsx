import type { Metadata } from 'next';
import { AvisoVistaPrevia } from '@/components/AvisoVistaPrevia';
import { exigirPagina } from '@/lib/paginas';
import { recortar } from '@/lib/formato';
import { fotoParaCompartir, metadatos, NOMBRE_SITIO, sinVacios, urlSitio } from '@/lib/seo';
import { DatosEstructurados } from '@/components/DatosEstructurados';
import { notFound } from 'next/navigation';
import { ActividadCompleta } from '@/components/ActividadCompleta';
import { actividadPorSlug, actividades, detalleActividad, firmarFotos, fotosDeBloques } from '@/lib/datos';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await actividadPorSlug((await params).slug);
  if (!a) return { title: 'Actividad no encontrada', robots: { index: false } };
  return metadatos({
    titulo: a.titulo,
    descripcion: a.introduccion ? recortar(a.introduccion, 155) : undefined,
    ruta: `/eventos/${a.slug}`,
    foto: await fotoParaCompartir(a.portada_foto_id),
  });
}

export default async function PaginaActividad({ params }: Props) {
  const { vistaPrevia } = await exigirPagina('eventos');
  const actividad = await actividadPorSlug((await params).slug);
  if (!actividad) notFound();

  const [d, todas] = await Promise.all([detalleActividad(actividad.id), actividades()]);
  const base = await urlSitio();
  const otras = todas.filter((a) => a.anio === actividad.anio && a.id !== actividad.id).slice(0, 3);
  const fotos = await firmarFotos([
    actividad.portada_foto_id, ...d.fotoIds, ...d.secciones.flatMap((s) => fotosDeBloques(s.contenido)), ...otras.map((a) => a.portada_foto_id),
    ...d.videos.map((v) => v.portada_foto_id),
  ]);

  const portada = fotos.get(actividad.portada_foto_id ?? '');

  return (
    <>
      <AvisoVistaPrevia activo={vistaPrevia} />
      {/* Evento para buscadores: solo si la actividad tiene fecha en la base (schema.org la exige). */}
      {actividad.fecha_inicio && (
        <DatosEstructurados datos={sinVacios({
          '@type': 'Event',
          name: actividad.titulo,
          description: actividad.introduccion,
          url: `${base}/eventos/${actividad.slug}`,
          // Con precisión de mes solo se informa año y mes.
          startDate: actividad.fecha_precision === 'mes' ? actividad.fecha_inicio.slice(0, 7) : actividad.fecha_inicio,
          endDate: actividad.fecha_precision === 'mes' ? undefined : actividad.fecha_fin,
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          location: actividad.lugar ? { '@type': 'Place', name: actividad.lugar, address: actividad.lugar } : undefined,
          organizer: { '@type': 'Organization', name: NOMBRE_SITIO, url: base },
          image: portada ? [portada.original ?? portada.url] : undefined,
        })} />
      )}
      <ActividadCompleta actividad={actividad} d={d} otras={otras} fotos={fotos} />
    </>
  );
}
