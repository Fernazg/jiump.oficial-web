import type { Metadata } from 'next';
import Link from 'next/link';
import { exigirSeccion } from '@/lib/admin/acceso';
import { crearContenido } from '@/lib/admin/acciones-contenido';
import { listarAlbumes } from '@/lib/admin/galerias';

export const metadata: Metadata = { title: 'Galerías y álbumes' };

export default async function Galerias({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  await exigirSeccion('galerias');
  const { aviso } = await searchParams;
  const albumes = await listarAlbumes();
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="adm-h1">Galerías y álbumes</h1>
          <span className="text-[15px] text-texto-3">Los álbumes publicados aparecen en la Galería. Cada álbum es de un solo evento.</span>
        </div>
        <form action={crearContenido.bind(null, 'album')}>
          <button className="adm-boton adm-primario min-h-[46px] px-[22px] text-[15px]">+ Nuevo álbum</button>
        </form>
      </div>
      {aviso === 'eliminado' && <p role="status" className="adm-ok">Álbum eliminado. Sus fotos siguen en la biblioteca.</p>}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4" data-lista-albumes>
        {albumes.map((a) => (
          <li key={a.id}>
            <Link href={`/admin/galerias/${a.id}`} data-album={a.slug} className="levantar adm-caja flex h-full flex-col gap-2 p-5">
              <span className="flex items-start justify-between gap-2">
                <strong className="text-[16px] leading-snug">{a.titulo}</strong>
                <span className={`adm-chip ${a.estado === 'publicado' ? 'bg-[#e0f5f3] text-[#00665f]' : 'bg-[#eef0f2] text-texto-2'}`}>
                  {a.estado === 'publicado' ? 'Publicado' : 'Borrador'}
                </span>
              </span>
              <span className="text-[13px] text-texto-3">
                {a.fotos} {a.fotos === 1 ? 'foto' : 'fotos'}{a.actividad ? ` · ${a.actividad}` : ''}{a.anio ? ` · ${a.anio}` : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {albumes.length === 0 && <p className="adm-caja p-8 text-center text-texto-3">Aún no hay álbumes.</p>}
    </>
  );
}
