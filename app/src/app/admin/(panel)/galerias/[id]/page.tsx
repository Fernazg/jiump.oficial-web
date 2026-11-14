import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EditorAlbum } from '@/components/admin/galerias/EditorAlbum';
import { exigirSeccion } from '@/lib/admin/acceso';
import { esUuid } from '@/lib/admin/bloques';
import { vistaPreviaContenidoAlDia } from '@/lib/admin/eventos';
import { actividadesVisibles, albumParaEditar, catalogoFotos } from '@/lib/admin/galerias';

export const metadata: Metadata = { title: 'Editar álbum' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> };

export default async function EditarAlbum({ params, searchParams }: Props) {
  await exigirSeccion('galerias');
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const datos = await albumParaEditar(id);
  if (!datos) notFound();
  const { aviso } = await searchParams;
  const [actividades, catalogo, previaAlDia] = await Promise.all([actividadesVisibles(), catalogoFotos(), vistaPreviaContenidoAlDia('album', id)]);
  const a = datos.album;
  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/admin/galerias" className="text-[14px] font-semibold text-azul">← Galerías y álbumes</Link>
        <h1 className="adm-h1">Editar álbum</h1>
      </div>
      <EditorAlbum key={a.actualizado_en} id={id} version={a.actualizado_en} estado={a.estado} previaAlDia={previaAlDia}
        actividades={actividades} catalogo={catalogo} aviso={aviso ?? null}
        inicial={{
          titulo: a.titulo, slug: a.slug, descripcion: a.descripcion ?? '', anio: a.anio ? String(a.anio) : '',
          pais: a.pais ?? '', ciudad: a.ciudad ?? '', actividad_id: a.actividad_id, portada_foto_id: a.portada_foto_id, fotos: datos.fotos,
        }} />
    </>
  );
}
