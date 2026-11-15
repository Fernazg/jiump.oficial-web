'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { EstadoFormulario } from '@/components/admin/Formulario';
import { permisoAccion } from './acceso';
import { esUuid } from './bloques';
import { invitarConServicio } from './invitar';
import type { Rol } from './secciones';
import { clientePanel } from './supabase-panel';
import { listarUsuarios, superadminsActivos } from './usuarios';

/**
 * Usuarios y roles (solo Superadmin). Todo se hace con la sesión de quien
 * administra (RLS + reglas de la base), salvo crear la cuenta e invitar,
 * que necesita la service role (ver invitar.ts).
 */
const ROLES: Rol[] = ['superadmin', 'editor', 'eventos', 'multimedia'];
const SIN_PERMISO = 'No tienes permiso para hacer esto.';
/** Lo exige también la base de datos (migración 11): el panel avisa antes, la base no deja pasar. */
const MINIMO_SUPERADMINS = 2;
const MENSAJE_MINIMO = 'Deben quedar al menos dos Superadministradores activos. Nombra otro antes de quitar este rol o desactivar a esta persona.';

async function origen(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function invitarUsuario(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  if (!(await permisoAccion('usuarios'))) return { error: SIN_PERMISO };
  const correo = String(f.get('correo') ?? '').trim().toLowerCase();
  const nombre = String(f.get('nombre') ?? '').trim().slice(0, 80);
  // Superadmin no se asigna al invitar: primero debe inscribir su doble factor.
  const roles = f.getAll('roles').map(String).filter((r): r is Rol => ROLES.includes(r as Rol) && r !== 'superadmin');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return { error: 'Escribe un correo válido.' };
  if (!nombre) return { error: 'Escribe el nombre de la persona.' };
  if (roles.length === 0) return { error: 'Elige al menos un rol.' };

  const r = await invitarConServicio(correo, nombre, `${await origen()}/admin/bienvenida`);
  if (!r.ok) return { error: r.error };

  // Roles con la sesión de quien invita (RLS: solo Superadmin).
  const supabase = await clientePanel();
  const { data: perfil } = await supabase.from('perfiles').select('id').eq('user_id', r.userId).maybeSingle();
  if (!perfil) return { error: 'Se envió la invitación, pero no se encontró el perfil. Asigna los roles desde la lista.' };
  const { error } = await supabase.from('perfil_roles').insert(roles.map((rol) => ({ perfil_id: perfil.id, rol })));
  if (error) return { error: 'Se envió la invitación, pero no se pudieron asignar los roles. Asígnalos desde la lista.' };
  redirect(`/admin/usuarios?aviso=invitado`);
}

/** Asignar o quitar un rol. Superadmin: solo con doble factor ya inscrito y sin bajar de dos. */
export async function cambiarRol(perfilId: string, rol: Rol, asignar: boolean): Promise<EstadoFormulario> {
  const acceso = await permisoAccion('usuarios');
  if (!acceso) return { error: SIN_PERMISO };
  if (!esUuid(perfilId) || !ROLES.includes(rol)) return { error: 'Datos no válidos.' };
  const usuarios = await listarUsuarios();
  const u = usuarios.find((x) => x.perfil_id === perfilId);
  if (!u) return { error: 'No se encontró a esa persona.' };
  if (rol === 'superadmin') {
    if (u.user_id === acceso.userId) return { error: 'No puedes cambiar tu propio rol de Superadministrador. Pídeselo a otro Superadministrador.' };
    if (asignar && !u.doble_factor) return { error: 'Para ser Superadministrador, primero debe inscribir su doble factor (desde «Mi cuenta»).' };
    if (asignar && !u.activo) return { error: 'Primero reactiva a esta persona.' };
    if (!asignar && u.activo && superadminsActivos(usuarios).length - 1 < MINIMO_SUPERADMINS) {
      return { error: `Debe haber al menos ${MINIMO_SUPERADMINS} Superadministradores activos. Nombra otro antes de quitar este rol.` };
    }
  }
  if (!asignar && u.roles.length === 1 && u.roles[0] === rol) return { error: 'La persona debe tener al menos un rol. Si ya no participa, desactívala.' };
  const supabase = await clientePanel();
  const { error } = asignar
    ? await supabase.from('perfil_roles').insert({ perfil_id: perfilId, rol })
    : await supabase.from('perfil_roles').delete().eq('perfil_id', perfilId).eq('rol', rol);
  if (error && error.code !== '23505') {
    return { error: error.hint === 'minimo_superadmins' ? MENSAJE_MINIMO : 'No se pudo cambiar el rol.' };
  }
  redirect(`/admin/usuarios/${perfilId}?aviso=${asignar ? 'rol-asignado' : 'rol-quitado'}`);
}

/** Desactivar (cierra sus sesiones al instante) o reactivar. */
export async function cambiarActivo(perfilId: string, activo: boolean): Promise<EstadoFormulario> {
  const acceso = await permisoAccion('usuarios');
  if (!acceso) return { error: SIN_PERMISO };
  if (!esUuid(perfilId)) return { error: 'Datos no válidos.' };
  const usuarios = await listarUsuarios();
  const u = usuarios.find((x) => x.perfil_id === perfilId);
  if (!u) return { error: 'No se encontró a esa persona.' };
  if (!activo && u.user_id === acceso.userId) return { error: 'No puedes desactivarte a ti mismo.' };
  if (!activo && u.roles.includes('superadmin') && superadminsActivos(usuarios).length - 1 < MINIMO_SUPERADMINS) {
    return { error: `Debe haber al menos ${MINIMO_SUPERADMINS} Superadministradores activos. Nombra otro antes de desactivar a esta persona.` };
  }
  const supabase = await clientePanel();
  const { data, error } = await supabase.from('perfiles').update({ activo }).eq('id', perfilId).select('id');
  if (error?.hint === 'minimo_superadmins') return { error: MENSAJE_MINIMO };
  if (error || !data?.length) return { error: 'No se pudo cambiar el estado.' };
  redirect(`/admin/usuarios/${perfilId}?aviso=${activo ? 'reactivado' : 'desactivado'}`);
}
