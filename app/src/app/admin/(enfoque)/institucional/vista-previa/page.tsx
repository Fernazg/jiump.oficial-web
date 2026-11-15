import type { Metadata } from 'next';
import { BarraVistaPrevia } from '@/components/admin/BarraVistaPrevia';
import { BotonAccion } from '@/components/admin/BotonAccion';
import { Encabezado, Pie } from '@/components/Marco';
import { NosotrosCompleto } from '@/components/NosotrosCompleto';
import { exigirSeccion } from '@/lib/admin/acceso';
import { publicar } from '@/lib/admin/acciones-contenido';
import { ID_CONJUNTO, institucionalParaEditar, paginaParaEditar } from '@/lib/admin/sitio';
import { comoInstitucional, comoSecciones, datosPagina, registrarVistaPrevia } from '@/lib/admin/vista-previa-sitio';

export const metadata: Metadata = { title: 'Vista previa de información institucional' };

/** Los textos institucionales se ven en Nosotros (y las cifras en Inicio): se muestran en Nosotros. */
export default async function VistaPreviaInstitucional() {
  await exigirSeccion('institucional');
  const [{ items, hayCambios }, nosotros] = await Promise.all([institucionalParaEditar(), paginaParaEditar('nosotros')]);
  const ok = await registrarVistaPrevia('institucional', ID_CONJUNTO);
  const vista = await datosPagina('nosotros', comoSecciones(nosotros?.datos.secciones ?? []), comoInstitucional(items));
  return (
    <>
      <BarraVistaPrevia volver="/admin/institucional" publicado cambios={hayCambios} error={!ok}>
        {ok && hayCambios && <BotonAccion accion={publicar.bind(null, 'institucional', ID_CONJUNTO)} className="adm-boton bg-white text-azul">Publicar los cambios</BotonAccion>}
      </BarraVistaPrevia>
      <Encabezado />
      <main id="contenido" className="flex-1 bg-white" data-vista-previa-contenido>
        {vista.nosotros && <NosotrosCompleto secs={vista.nosotros.secs} inst={vista.nosotros.inst} fotos={vista.fotos} />}
      </main>
      <Pie />
    </>
  );
}
