import { NOMBRE_ROL, type Rol } from '@/lib/admin/secciones';

const TONO: Record<Rol, string> = {
  superadmin: 'bg-azul-profundo text-white',
  editor: 'bg-azul-claro text-azul-oscuro',
  eventos: 'bg-[#e0f5f3] text-[#00665f]',
  multimedia: 'bg-rojo-claro text-rojo-oscuro',
};
export const ChipRol = ({ rol }: { rol: Rol }) => <span className={`adm-chip ${TONO[rol]}`} data-rol={rol}>{NOMBRE_ROL[rol]}</span>;
