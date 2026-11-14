import type { Metadata } from 'next';
import { AvisoVistaPrevia } from '@/components/AvisoVistaPrevia';
import { exigirPagina } from '@/lib/paginas';
import { notFound } from 'next/navigation';
import { ActividadCompleta } from '@/components/ActividadCompleta';
import { actividadPorSlug, actividades, detalleActividad, firmarFotos, fotosDeBloques } from '@/lib/datos';

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

  return (
    <>
      <AvisoVistaPrevia activo={vistaPrevia} />
      <ActividadCompleta actividad={actividad} d={d} otras={otras} fotos={fotos} />
    </>
  );
}
