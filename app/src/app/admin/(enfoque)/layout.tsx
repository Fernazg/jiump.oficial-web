import { exigirAcceso } from '@/lib/admin/acceso';

export const dynamic = 'force-dynamic';

/** Editor y vista previa: a pantalla completa, sin la barra lateral (como en el diseño). */
export default async function EnfoqueLayout({ children }: { children: React.ReactNode }) {
  await exigirAcceso();
  return <>{children}</>;
}
