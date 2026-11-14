import Link from 'next/link';
import type { ReactNode } from 'react';

/** Barra superior de las vistas previas del panel (fuera de la página del sitio). */
export function BarraVistaPrevia({ volver, publicado, error, children }: {
  volver: string; publicado: boolean; error: boolean; children?: ReactNode;
}) {
  return (
    <div className="relative z-50 border-b-2 border-turquesa bg-azul-profundo text-white" data-barra-vista-previa>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
        <div className="text-[14px]">
          <strong className="font-ui">Vista previa</strong>
          <span className="text-white/80"> · así se verá en el sitio. {publicado ? 'Ya está publicado.' : 'Aún no es visible para el público.'}</span>
          {error && <span className="block text-turquesa-claro">No se pudo registrar la vista previa. Recarga la página.</span>}
        </div>
        <div className="flex flex-wrap items-start gap-2.5">
          <Link href={volver} className="adm-boton bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.6)]">← Volver al editor</Link>
          {children}
        </div>
      </div>
    </div>
  );
}
