import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AlbumCompleto } from '@/components/AlbumCompleto';
import { BarraVistaPrevia } from '@/components/admin/BarraVistaPrevia';
import { BotonAccion } from '@/components/admin/BotonAccion';
import { Encabezado, Pie } from '@/components/Marco';
import { exigirSeccion } from '@/lib/admin/acceso';
import { publicar } from '@/lib/admin/acciones-contenido';
import { esUuid } from '@/lib/admin/bloques';
import { clientePanel } from '@/lib/admin/supabase-panel';
import { actividades, firmarFotos, videosDeAlbum } from '@/lib/datos';
import type { Album } from '@/lib/tipos';

export const metadata: Metadata = { title: 'Vista previa de álbum' };

/** Vista previa obligatoria de un álbum: la misma vista que su dirección en la Galería. */
export default async function VistaPreviaAlbum({ params }: { params: Promise<{ id: string }> }) {
  await exigirSeccion('galerias');
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const supabase = await clientePanel();
  const [{ data }, { data: rel }] = await Promise.all([
    supabase.from('albumes').select('id, titulo, slug, descripcion, anio, pais, ciudad, actividad_id, portada_foto_id, orden, estado').eq('id', id).maybeSingle(),
    supabase.from('album_fotos').select('foto_id').eq('album_id', id).order('orden'),
  ]);
  if (!data) notFound();
  const { estado, ...album } = data as Album & { estado: string };
  const fotoIds = ((rel ?? []) as { foto_id: string }[]).map((x) => x.foto_id);

  const { data: huella } = await supabase.rpc('huella_contenido', { p_tipo: 'album', p_id: id });
  const registro = huella ? await supabase.from('vistas_previas_contenido').insert({ tipo: 'album', registro_id: id, huella }) : { error: true };

  const [fotos, videos, acts] = await Promise.all([firmarFotos(fotoIds, supabase), videosDeAlbum(id), actividades()]);
  return (
    <>
      <BarraVistaPrevia volver={`/admin/galerias/${id}`} publicado={estado === 'publicado'} error={Boolean(registro.error)}>
        {!registro.error && estado !== 'publicado' && (
          <BotonAccion accion={publicar.bind(null, 'album', id)} className="adm-boton bg-white text-azul">Publicar ahora</BotonAccion>
        )}
      </BarraVistaPrevia>
      <Encabezado />
      <main id="contenido" className="flex-1 bg-white" data-vista-previa-contenido>
        <AlbumCompleto album={{ ...album, fotoIds }} fotos={fotos} videos={videos} actividad={acts.find((x) => x.id === album.actividad_id)} />
      </main>
      <Pie />
    </>
  );
}
