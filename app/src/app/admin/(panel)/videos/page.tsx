import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirSeccion } from '@/lib/admin/acceso';
import { listarVideos } from '@/lib/admin/galerias';

export const metadata: Metadata = { title: 'Videos' };

export default async function Videos({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  await exigirSeccion('videos');
  const { aviso } = await searchParams;
  const videos = await listarVideos();
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="adm-h1">Videos</h1>
          <span className="text-[15px] text-texto-3">Videos de YouTube que aparecen en el sitio, en un álbum o en una actividad.</span>
        </div>
        <Link href="/admin/videos/nuevo" className="adm-boton adm-primario min-h-[46px] px-[22px] text-[15px]">+ Agregar video</Link>
      </div>
      {aviso === 'eliminado' && <p role="status" className="adm-ok">Video eliminado del sitio. Sigue en YouTube.</p>}
      {videos.length === 0 ? (
        <p className="adm-caja p-8 text-center text-texto-3">No hay videos. Usa «+ Agregar video» para sumar uno.</p>
      ) : (
        <ul className="adm-caja divide-y divide-[#e7e9ec] px-5" data-lista-videos>
          {videos.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5" data-video={v.id}>
              <span className="flex min-w-0 flex-col">
                <Link href={`/admin/videos/${v.id}`} className="font-semibold hover:text-azul">{v.titulo}</Link>
                <span className="text-[13px] text-texto-3">{v.donde ?? 'Sin asignar'}</span>
              </span>
              <span className={`adm-chip ${v.estado === 'publicado' ? 'bg-[#e0f5f3] text-[#00665f]' : 'bg-[#eef0f2] text-texto-2'}`}>
                {v.estado === 'publicado' ? 'Publicado' : 'Oculto'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
