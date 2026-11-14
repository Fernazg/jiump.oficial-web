import { ProximaEtapa } from '@/components/admin/ProximaEtapa';
import { exigirSeccion } from '@/lib/admin/acceso';
import { seccion } from '@/lib/admin/secciones';

export const metadata = { title: seccion('eventos').nombre };

export default async function Pagina() {
  await exigirSeccion('eventos');
  return <ProximaEtapa clave="eventos" />;
}
