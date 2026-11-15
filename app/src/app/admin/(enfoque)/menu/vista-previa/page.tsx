import type { Metadata } from 'next';
import { BarraVistaPrevia } from '@/components/admin/BarraVistaPrevia';
import { BotonAccion } from '@/components/admin/BotonAccion';
import { Encabezado, Pie } from '@/components/Marco';
import { exigirSeccion } from '@/lib/admin/acceso';
import { publicar } from '@/lib/admin/acciones-contenido';
import { ID_CONJUNTO, menuParaEditar } from '@/lib/admin/sitio';
import { registrarVistaPrevia } from '@/lib/admin/vista-previa-sitio';

export const metadata: Metadata = { title: 'Vista previa del menú' };

/** Vista previa del menú principal y el pie con los cambios guardados. */
export default async function VistaPreviaMenu() {
  await exigirSeccion('menu');
  const { items, hayCambios } = await menuParaEditar();
  const ok = await registrarVistaPrevia('menu', ID_CONJUNTO);
  const visibles = items.filter((i) => i.visible).map((i, n) => ({ ...i, id: `previa-${n}`, orden: n }));
  return (
    <>
      <BarraVistaPrevia volver="/admin/menu" publicado cambios={hayCambios} error={!ok}>
        {ok && hayCambios && <BotonAccion accion={publicar.bind(null, 'menu', ID_CONJUNTO)} className="adm-boton bg-white text-azul">Publicar los cambios</BotonAccion>}
      </BarraVistaPrevia>
      <Encabezado items={visibles} />
      <main id="contenido" className="flex-1 bg-white" data-vista-previa-contenido>
        <section className="contenedor py-16">
          <p className="t-etiqueta text-azul-oscuro">Menú principal y pie</p>
          <p className="mt-3 max-w-[640px] text-texto-2">Arriba se ve el menú principal y abajo el pie de página, tal como quedarán en todas las páginas del sitio.</p>
          {items.some((i) => !i.visible) && (
            <p className="mt-3 max-w-[640px] text-texto-2">Ocultos (no aparecen): {items.filter((i) => !i.visible).map((i) => i.etiqueta).join(', ')}.</p>
          )}
        </section>
      </main>
      <Pie items={visibles} />
    </>
  );
}
