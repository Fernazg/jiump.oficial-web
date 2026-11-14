import type { Metadata } from 'next';
import { SinPermiso } from '@/components/admin/SinPermiso';

export const metadata: Metadata = { title: 'Sin permiso' };

/** Página del 403 (el proxy reescribe aquí con estado 403). */
export default function PaginaSinPermiso() {
  return <SinPermiso />;
}
