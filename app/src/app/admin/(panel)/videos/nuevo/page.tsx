import type { Metadata } from 'next';
import Link from 'next/link';
import { FormularioVideo } from '@/components/admin/galerias/FormularioVideo';
import { exigirSeccion } from '@/lib/admin/acceso';
import { destinosVideo } from '@/lib/admin/destinos-video';

export const metadata: Metadata = { title: 'Agregar video' };

export default async function NuevoVideo() {
  await exigirSeccion('videos');
  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/admin/videos" className="text-[14px] font-semibold text-azul">← Videos</Link>
        <h1 className="adm-h1">Agregar video</h1>
        <span className="text-[15px] text-texto-3">Queda oculto hasta que revises la vista previa y lo publiques.</span>
      </div>
      <section className="adm-caja max-w-[720px] p-6"><FormularioVideo video={null} destinos={await destinosVideo()} /></section>
    </>
  );
}
