import { ProximaEtapa } from '@/components/admin/ProximaEtapa';
import { exigirSeccion } from '@/lib/admin/acceso';
import { seccion } from '@/lib/admin/secciones';

export const metadata = { title: seccion('fotos').nombre };

export default async function Pagina() {
  await exigirSeccion('fotos');
  return <ProximaEtapa clave="fotos" />;
}
