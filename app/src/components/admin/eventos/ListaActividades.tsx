import Link from 'next/link';
import type { FilaActividad } from '@/lib/admin/eventos';
import { etiquetaActividad } from '@/lib/formato';

/** Lista de actividades (columna izquierda del diseño AdminActividades). */
export function ListaActividades({ lista, actual }: { lista: FilaActividad[]; actual?: string }) {
  return (
    <nav aria-label="Actividades" className="adm-caja flex min-w-0 flex-col gap-1.5 p-3" data-lista-actividades>
      {lista.length === 0 && <p className="p-4 text-center text-[14px] text-texto-3">Aún no hay actividades.</p>}
      {lista.map((a) => {
        const on = a.id === actual;
        return (
          <Link key={a.id} href={`/admin/eventos/${a.id}`} aria-current={on ? 'page' : undefined} data-actividad={a.slug}
            className={`flex items-center justify-between gap-3 rounded-[14px] border-2 p-3.5 ${on ? 'border-azul bg-azul-claro' : 'border-transparent hover:bg-gris-claro'}`}>
            <span className="flex min-w-0 flex-col gap-0.5">
              <strong className="text-[15px] leading-snug">{a.titulo}</strong>
              <span className="text-[12.5px] text-texto-3">
                {etiquetaActividad(a)} · {a.fotos ? `${a.fotos} ${a.fotos === 1 ? 'foto' : 'fotos'}` : 'Sin fotos'}
                {a.destacar_inicio && ' · En Inicio'}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className={`adm-chip ${a.estado === 'publicado' ? 'bg-[#e0f5f3] text-[#00665f]' : 'bg-[#eef0f2] text-texto-2'}`}>
                {a.estado === 'publicado' ? 'Publicada' : a.estado === 'archivado' ? 'Archivada' : 'Borrador'}
              </span>
              {a.es_proximo && <span className="adm-chip bg-rojo text-white" data-es-proximo>Próximo</span>}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
