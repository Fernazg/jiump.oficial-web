import { ProximaEtapa } from '@/components/admin/ProximaEtapa';
import { exigirSeccion } from '@/lib/admin/acceso';
import { seccion } from '@/lib/admin/secciones';

export const metadata = { title: seccion('pagina-web').nombre };

export default async function Pagina() {
  await exigirSeccion('pagina-web');
  return <ProximaEtapa clave="pagina-web" />;
}
