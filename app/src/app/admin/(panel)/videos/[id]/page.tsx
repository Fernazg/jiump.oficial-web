import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BotonAccion } from '@/components/admin/BotonAccion';
import { Confirmar } from '@/components/admin/Confirmar';
import { FormularioVideo } from '@/components/admin/galerias/FormularioVideo';
import { exigirSeccion } from '@/lib/admin/acceso';
import { descartarCambios, despublicar, eliminar, publicar } from '@/lib/admin/acciones-contenido';
import { esUuid } from '@/lib/admin/bloques';
import { destinosVideo } from '@/lib/admin/destinos-video';
import { cambiosPendientes, vistaPreviaContenidoAlDia } from '@/lib/admin/eventos';
import { clientePanel } from '@/lib/admin/supabase-panel';

export const metadata: Metadata = { title: 'Editar video' };

const AVISOS: Record<string, string> = {
  creado: 'Video agregado. Está oculto: revisa la vista previa y publícalo.',
  guardado: 'Cambios guardados.',
  'cambios-publicados': 'Cambios publicados en el sitio.',
  descartados: 'Se descartaron los cambios sin publicar.',
  publicado: 'Video publicado en el sitio.',
  borrador: 'Video oculto: ya no se ve en el sitio.',
};

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> };

export default async function EditarVideo({ params, searchParams }: Props) {
  await exigirSeccion('videos');
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const supabase = await clientePanel();
  const { data: v } = await supabase.from('videos').select('id, url, titulo, descripcion, album_id, actividad_id, estado, actualizado_en').eq('id', id).maybeSingle();
  if (!v) notFound();
  const { aviso } = await searchParams;
  const [destinos, previaAlDia] = await Promise.all([destinosVideo(), vistaPreviaContenidoAlDia('video', id)]);
  const publicado = v.estado === 'publicado';
  // Publicado: lo editado queda pendiente hasta revisar la vista previa y publicarlo.
  const cambios = publicado ? await cambiosPendientes('video', id) : null;
  const c = (cambios?.datos ?? {}) as { url?: string; titulo?: string; descripcion?: string; album_id?: string; actividad_id?: string };
  const actual = cambios
    ? { url: c.url ?? v.url, titulo: c.titulo ?? v.titulo, descripcion: c.descripcion ?? '', album_id: c.album_id || null, actividad_id: c.actividad_id || null }
    : { url: v.url, titulo: v.titulo, descripcion: v.descripcion ?? '', album_id: v.album_id, actividad_id: v.actividad_id };
  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/admin/videos" className="text-[14px] font-semibold text-azul">← Videos</Link>
        <h1 className="adm-h1">Editar video</h1>
      </div>
      {aviso && AVISOS[aviso] && <p role="status" className="adm-ok">{AVISOS[aviso]}</p>}
      <div className="flex flex-wrap items-start gap-6">
        <section className="adm-caja flex min-w-0 flex-[3_1_480px] flex-col gap-4 p-6" data-editor-video>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span data-estado-contenido={v.estado} className={`adm-chip ${publicado ? 'bg-[#e0f5f3] text-[#00665f]' : 'bg-[#eef0f2] text-texto-2'}`}>
              {publicado ? 'Publicado' : 'Oculto'}
            </span>
            <div className="flex flex-wrap gap-2.5">
              <Link href={`/admin/videos/${id}/vista-previa`} className="adm-boton adm-secundario">Vista previa</Link>
              {publicado ? (
                <>
                  {cambios && (
                    <BotonAccion accion={publicar.bind(null, 'video', id)} disabled={!previaAlDia} data-publicar-cambios
                      titulo={previaAlDia ? undefined : 'Primero revisa la vista previa'}>Publicar cambios</BotonAccion>
                  )}
                  <BotonAccion accion={despublicar.bind(null, 'video', id)} className="adm-boton adm-borde-azul">Ocultar</BotonAccion>
                </>
              ) : (
                <BotonAccion accion={publicar.bind(null, 'video', id)} disabled={!previaAlDia} data-publicar
                  titulo={previaAlDia ? undefined : 'Primero revisa la vista previa'}>Publicar</BotonAccion>
              )}
              <Confirmar boton="Eliminar" claseBoton="adm-boton bg-white text-rojo-oscuro shadow-[inset_0_0_0_1.5px_var(--color-rojo)]"
                titulo="¿Eliminar este video?" accion={eliminar.bind(null, 'video', id)}>
                Dejará de verse en el sitio. El video sigue en YouTube.
              </Confirmar>
            </div>
          </div>
          {!publicado && !previaAlDia && <p className="adm-aviso" data-falta-previa>Para publicar, revisa la vista previa de lo guardado.</p>}
          {publicado && !cambios && (
            <p className="adm-aviso" data-aviso-publicado>Está publicado. Lo que edites se guarda aparte y <strong>no cambia el sitio</strong> hasta que revises la vista previa y publiques los cambios.</p>
          )}
          {publicado && cambios && (
            <div className="adm-aviso flex flex-wrap items-center gap-x-2" data-cambios-pendientes>
              <span><strong>Hay cambios sin publicar.</strong> El sitio sigue mostrando la versión publicada.</span>
              <Confirmar boton="Descartar cambios" claseBoton="font-semibold underline" titulo="¿Descartar los cambios sin publicar?" confirmar="Sí, descartar"
                accion={descartarCambios.bind(null, 'video', id)}>Vuelve a quedar como está publicado.</Confirmar>
            </div>
          )}
          <FormularioVideo key={cambios?.actualizado_en ?? v.actualizado_en} destinos={destinos} video={{
            id, url: actual.url, titulo: actual.titulo, descripcion: actual.descripcion, version: cambios?.actualizado_en ?? v.actualizado_en,
            destino: actual.album_id ? `album:${actual.album_id}` : actual.actividad_id ? `actividad:${actual.actividad_id}` : '',
          }} />
        </section>
      </div>
    </>
  );
}
