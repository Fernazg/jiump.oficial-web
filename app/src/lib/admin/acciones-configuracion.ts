'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { EstadoFormulario } from '@/components/admin/Formulario';
import { permisoAccion } from './acceso';
import { esUuid } from './bloques';
import { clientePanel } from './supabase-panel';

/** Configuración del sitio y redirecciones (solo Superadmin; RLS lo exige). */
const SIN_PERMISO = 'No tienes permiso para hacer esto.';
const t = (f: FormData, k: string, max: number) => String(f.get(k) ?? '').trim().slice(0, max);

export async function guardarConfiguracion(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  if (!(await permisoAccion('configuracion'))) return { error: SIN_PERMISO };
  const instagram = t(f, 'instagram_url', 200);
  if (instagram && !/^https:\/\/(www\.)?instagram\.com\/[^\s]+$/.test(instagram)) return { error: 'El enlace de Instagram debe ser como https://www.instagram.com/usuario' };
  const foto = (k: string) => { const v = String(f.get(k) ?? ''); return esUuid(v) ? v : null; };
  const supabase = await clientePanel();
  const { data, error } = await supabase.from('configuracion').update({
    instagram_url: instagram || null,
    mostrar_barra_proximo_evento: f.get('mostrar_barra_proximo_evento') === 'on',
    seo_titulo: t(f, 'seo_titulo', 70) || null,
    seo_descripcion: t(f, 'seo_descripcion', 170) || null,
    seo_foto_id: foto('seo_foto_id'),
    mantenimiento_foto_id: foto('mantenimiento_foto_id'),
  }).eq('id', true).select('id');
  if (error || !data?.length) return { error: 'No se pudo guardar la configuración.' };
  revalidatePath('/', 'layout');
  return { ok: 'Configuración guardada. Ya se aplica en el sitio.' };
}

/** Modo mantenimiento: el sitio público responde 503 con la página de mantenimiento (el panel sigue funcionando). */
export async function cambiarMantenimiento(activo: boolean): Promise<EstadoFormulario> {
  if (!(await permisoAccion('configuracion'))) return { error: SIN_PERMISO };
  const supabase = await clientePanel();
  const { data, error } = await supabase.from('configuracion').update({ modo_mantenimiento: activo }).eq('id', true).select('id');
  if (error || !data?.length) return { error: 'No se pudo cambiar el modo mantenimiento.' };
  redirect(`/admin/configuracion?aviso=${activo ? 'mantenimiento-on' : 'mantenimiento-off'}`);
}

/** Redirección 301 desde una URL antigua de Wix (ruta que empieza con /). */
export async function agregarRedireccion(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  if (!(await permisoAccion('configuracion'))) return { error: SIN_PERMISO };
  let origen = t(f, 'origen', 300);
  const destino = t(f, 'destino', 300);
  // Se acepta la URL completa de Wix y se guarda solo su ruta.
  try { if (/^https?:\/\//.test(origen)) origen = new URL(origen).pathname; } catch { /* queda igual y falla abajo */ }
  origen = origen.replace(/\/+$/, '') || '/';
  if (!/^\/[^\s]*$/.test(origen) || origen === '/' || origen.startsWith('/admin')) return { error: 'La dirección antigua debe ser una ruta como /post/mi-articulo (no puede ser el inicio ni el panel).' };
  if (!/^(\/[^\s]*|https:\/\/[^\s]+)$/.test(destino)) return { error: 'El destino debe empezar con / (página del sitio) o https://' };
  if (origen === destino) return { error: 'El destino no puede ser la misma dirección.' };
  const supabase = await clientePanel();
  const { error } = await supabase.from('redirecciones').insert({ origen, destino, codigo: 301 });
  if (error) return { error: error.code === '23505' ? 'Esa dirección antigua ya tiene una redirección.' : 'No se pudo agregar la redirección.' };
  redirect('/admin/configuracion?aviso=redireccion#redirecciones');
}

export async function eliminarRedireccion(id: string): Promise<EstadoFormulario> {
  if (!(await permisoAccion('configuracion'))) return { error: SIN_PERMISO };
  if (!esUuid(id)) return { error: 'Datos no válidos.' };
  const supabase = await clientePanel();
  const { data, error } = await supabase.from('redirecciones').delete().eq('id', id).select('id');
  if (error || !data?.length) return { error: 'No se pudo eliminar la redirección.' };
  redirect('/admin/configuracion?aviso=redireccion-eliminada#redirecciones');
}
