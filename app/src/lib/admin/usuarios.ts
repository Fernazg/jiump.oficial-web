import 'server-only';
import type { Rol } from './secciones';
import { clientePanel } from './supabase-panel';

/** Personas del equipo (solo Superadmin: usuarios_panel() lo exige en la base). */
export type UsuarioPanel = {
  perfil_id: string; user_id: string; nombre: string; correo: string; activo: boolean; ultimo_ingreso: string | null;
  roles: Rol[]; doble_factor: boolean; superadmin_vigente: boolean; invitacion_pendiente: boolean;
};

export async function listarUsuarios(): Promise<UsuarioPanel[]> {
  const supabase = await clientePanel();
  const { data, error } = await supabase.rpc('usuarios_panel');
  if (error) throw new Error(`No se pudo leer la lista de usuarios: ${error.message}`);
  return (data ?? []) as UsuarioPanel[];
}

/** Superadmins activos (la regla del equipo: al menos dos; la base: nunca cero). */
export const superadminsActivos = (xs: UsuarioPanel[]) => xs.filter((u) => u.activo && u.roles.includes('superadmin'));
