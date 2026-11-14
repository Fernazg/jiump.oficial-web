import { ProximaEtapa } from '@/components/admin/ProximaEtapa';
import { exigirSeccion } from '@/lib/admin/acceso';
import { seccion } from '@/lib/admin/secciones';

export const metadata = { title: seccion('configuracion').nombre };

export default async function Pagina() {
  await exigirSeccion('configuracion');
  return <ProximaEtapa clave="configuracion" />;
}
