import { BarraLateral } from '@/components/admin/BarraLateral';
import { exigirAcceso } from '@/lib/admin/acceso';
import { cerrarSesion } from '@/lib/admin/acciones-acceso';

export const dynamic = 'force-dynamic';

/** Estructura del panel: barra lateral (según roles) + contenido. */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const acceso = await exigirAcceso();
  return (
    <div className="flex flex-1 flex-col nav:flex-row">
      <BarraLateral nombre={acceso.nombre} roles={acceso.roles} efectivos={acceso.efectivos} cerrarSesion={cerrarSesion} />
      <main id="contenido" className="flex min-w-0 flex-1 flex-col gap-6 px-5 pb-12 pt-6 sm:px-8 lg:px-10 lg:pt-8">
        {children}
      </main>
    </div>
  );
}
