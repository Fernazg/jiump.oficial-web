import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ActividadCompleta } from '@/components/ActividadCompleta';
import { BarraVistaPrevia } from '@/components/admin/BarraVistaPrevia';
import { BotonAccion } from '@/components/admin/BotonAccion';
import { Encabezado, Pie } from '@/components/Marco';
import { exigirSeccion } from '@/lib/admin/acceso';
import { publicar } from '@/lib/admin/acciones-contenido';
import { esUuid } from '@/lib/admin/bloques';
import { actividadDesdeCambios, cambiosPendientes, type ActividadPanel } from '@/lib/admin/eventos';
import { clientePanel } from '@/lib/admin/supabase-panel';
import { actividades, detalleActividad, firmarFotos, fotosDeBloques } from '@/lib/datos';
import type { Actividad } from '@/lib/tipos';

export const metadata: Metadata = { title: 'Vista previa de actividad' };

/**
 * Vista previa obligatoria de una actividad: la misma página que el sitio
 * (ActividadCompleta), con la sesión de la persona. Al abrirla, la base
 * registra que vio ESTE contenido; recién entonces se puede publicar.
 */
export default async function VistaPreviaActividad({ params }: { params: Promise<{ id: string }> }) {
  await exigirSeccion('eventos');
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const supabase = await clientePanel();
  const { data } = await supabase.from('actividades')
    .select('id, titulo, slug, tipo, anio, fecha_inicio, fecha_precision, fecha_fin, lugar, zona, introduccion, portada_foto_id, destacar_inicio, orden_inicio, es_proximo, lema, cita_texto, cita_referencia, abreviatura, estado')
    .eq('id', id).maybeSingle();
  if (!data) notFound();
  const { estado, ...vivo } = data as Actividad & { estado: string };
  const cambios = estado === 'publicado' ? await cambiosPendientes('actividad', id) : null;
  const pendiente = cambios ? actividadDesdeCambios({ ...vivo, estado: 'publicado', actualizado_en: '' } as ActividadPanel, cambios.datos) : null;
  const actividad: Actividad = pendiente ? (({ estado: _e, actualizado_en: _a, ...x }) => x)(pendiente.actividad) : vivo; // eslint-disable-line @typescript-eslint/no-unused-vars

  const { data: huella } = await supabase.rpc('huella_contenido', { p_tipo: 'actividad', p_id: id });
  const registro = huella ? await supabase.from('vistas_previas_contenido').insert({ tipo: 'actividad', registro_id: id, huella }) : { error: true };

  // Secciones, enlaces y fotos con la sesión (aunque esté en borrador); videos y
  // álbumes, solo los publicados (como en el sitio).
  const [dPanel, dSitio, todas] = await Promise.all([detalleActividad(id, supabase), detalleActividad(id), actividades()]);
  const d = pendiente
    ? {
        secciones: pendiente.secciones.map((x, i) => ({ id: `s${i}`, titulo: x.titulo, contenido: x.contenido, orden: i })),
        enlaces: pendiente.enlaces.map((x, i) => ({ id: `e${i}`, titulo: x.titulo, url: x.url, orden: i, portada_foto_id: x.portada_foto_id || null })),
        fotoIds: pendiente.fotos, videos: dSitio.videos, albumes: dSitio.albumes,
      }
    : { ...dPanel, videos: dSitio.videos, albumes: dSitio.albumes };
  const otras = todas.filter((a) => a.anio === actividad.anio && a.id !== id).slice(0, 3);
  const fotos = await firmarFotos([
    actividad.portada_foto_id, ...d.fotoIds, ...d.secciones.flatMap((s) => fotosDeBloques(s.contenido)), ...otras.map((a) => a.portada_foto_id),
    ...d.videos.map((v) => v.portada_foto_id), ...d.enlaces.map((e) => e.portada_foto_id),
  ], supabase);

  return (
    <>
      <BarraVistaPrevia volver={`/admin/eventos/${id}`} publicado={estado === 'publicado'} cambios={Boolean(cambios)} error={Boolean(registro.error)}>
        {!registro.error && (estado !== 'publicado' || cambios) && (
          <BotonAccion accion={publicar.bind(null, 'actividad', id)} className="adm-boton bg-white text-azul">{cambios ? 'Publicar los cambios' : 'Publicar ahora'}</BotonAccion>
        )}
      </BarraVistaPrevia>
      <Encabezado />
      <main id="contenido" className="flex-1 bg-white" data-vista-previa-contenido>
        <ActividadCompleta actividad={actividad} d={d} otras={otras} fotos={fotos} />
      </main>
      <Pie />
    </>
  );
}
