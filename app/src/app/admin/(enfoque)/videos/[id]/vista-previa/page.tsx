import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BarraVistaPrevia } from '@/components/admin/BarraVistaPrevia';
import { BotonAccion } from '@/components/admin/BotonAccion';
import { Encabezado, Pie } from '@/components/Marco';
import { exigirSeccion } from '@/lib/admin/acceso';
import { publicar } from '@/lib/admin/acciones-contenido';
import { esUuid } from '@/lib/admin/bloques';
import { clientePanel } from '@/lib/admin/supabase-panel';
import { idYoutube } from '@/lib/formato';

export const metadata: Metadata = { title: 'Vista previa de video' };

/** Vista previa de un video: tal como aparece en su álbum o actividad del sitio. */
export default async function VistaPreviaVideo({ params }: { params: Promise<{ id: string }> }) {
  await exigirSeccion('videos');
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const supabase = await clientePanel();
  const { data: v } = await supabase.from('videos').select('id, url, titulo, estado, albumes(titulo), actividades(titulo)').eq('id', id).maybeSingle();
  if (!v) notFound();
  const { data: huella } = await supabase.rpc('huella_contenido', { p_tipo: 'video', p_id: id });
  const registro = huella ? await supabase.from('vistas_previas_contenido').insert({ tipo: 'video', registro_id: id, huella }) : { error: true };
  const yt = idYoutube(v.url);
  const rel = v as unknown as { albumes: { titulo: string } | null; actividades: { titulo: string } | null };
  const donde = rel.albumes?.titulo ? `Galería › ${rel.albumes.titulo}` : rel.actividades?.titulo ? `Eventos › ${rel.actividades.titulo} › Videos y transmisiones` : null;

  return (
    <>
      <BarraVistaPrevia volver={`/admin/videos/${id}`} publicado={v.estado === 'publicado'} error={Boolean(registro.error)}>
        {!registro.error && v.estado !== 'publicado' && (
          <BotonAccion accion={publicar.bind(null, 'video', id)} className="adm-boton bg-white text-azul">Publicar ahora</BotonAccion>
        )}
      </BarraVistaPrevia>
      <Encabezado />
      <main id="contenido" className="flex-1 bg-white" data-vista-previa-contenido>
        <section className="contenedor py-16">
          {donde && <p className="t-meta mb-6 font-normal text-texto-2">Aparece en: {donde}</p>}
          <ul className="grid gap-6 lg:grid-cols-2">
            <li>
              {yt ? (
                <div className="aspect-video overflow-hidden rounded-[18px] bg-azul-profundo">
                  <iframe className="size-full" src={`https://www.youtube-nocookie.com/embed/${yt}`} title={v.titulo} loading="lazy"
                    allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                </div>
              ) : null}
              <p className="t-meta mt-3">{v.titulo}</p>
            </li>
          </ul>
        </section>
      </main>
      <Pie />
    </>
  );
}
