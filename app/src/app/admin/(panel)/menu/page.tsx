import { ProximaEtapa } from '@/components/admin/ProximaEtapa';
import { exigirSeccion } from '@/lib/admin/acceso';
import { seccion } from '@/lib/admin/secciones';

export const metadata = { title: seccion('menu').nombre };

export default async function Pagina() {
  await exigirSeccion('menu');
  return <ProximaEtapa clave="menu" />;
}
