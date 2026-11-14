'use server';

import { redirect } from 'next/navigation';
import type { EstadoFormulario } from '@/components/admin/Formulario';
import { permisoAccion } from './acceso';
import { esUuid, slugDesde } from './bloques';
import { clientePanel } from './supabase-panel';

/** Series y temas (Superadmin y Editor). Una serie con artículos no se borra. */

async function exigir() {
  if (!(await permisoAccion('series'))) throw new Error('No tienes permiso para gestionar series y temas.');
  return clientePanel();
}

const t = (d: FormData, k: string) => String(d.get(k) ?? '').trim();

function datosSerie(d: FormData): Record<string, unknown> | string {
  const nombre = t(d, 'nombre').slice(0, 120);
  if (!nombre) return 'La serie necesita un nombre.';
  const tipo = t(d, 'tipo') === 'mes' ? 'mes' : 'tematica';
  const mes = Number(t(d, 'mes'));
  if (tipo === 'mes' && !(mes >= 1 && mes <= 12)) return 'Una serie del mes necesita el mes.';
  const color = ['azul', 'rojo', 'neutro'].includes(t(d, 'color')) ? t(d, 'color') : 'neutro';
  const orden = Number.parseInt(t(d, 'orden'), 10);
  return {
    nombre,
    slug: slugDesde(t(d, 'slug') || nombre),
    descripcion: t(d, 'descripcion').slice(0, 600) || null,
    tipo,
    mes: tipo === 'mes' ? mes : null,
    color,
    orden: Number.isFinite(orden) ? orden : 0,
  };
}

function error(e: { code?: string } | null, porDefecto: string): EstadoFormulario {
  if (e?.code === '23505') return { error: 'Ya existe otra con ese nombre o esa dirección (slug).' };
  if (e?.code === '23503') return { error: 'Esta serie tiene artículos: muévelos a otra serie antes de borrarla.' };
  if (e?.code === '42501') return { error: 'No tienes permiso para hacer esto.' };
  return { error: porDefecto };
}

export async function guardarSerie(_: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const supabase = await exigir();
  const datos = datosSerie(d);
  if (typeof datos === 'string') return { error: datos };
  const id = t(d, 'id');
  const r = esUuid(id)
    ? await supabase.from('series').update(datos).eq('id', id).select('id')
    : await supabase.from('series').insert(datos).select('id');
  if (r.error || !r.data?.length) return error(r.error, 'No se pudo guardar la serie.');
  redirect(`/admin/articulos/series?aviso=${esUuid(id) ? 'serie-editada' : 'serie-creada'}`);
}

export async function borrarSerie(id: string): Promise<EstadoFormulario> {
  const supabase = await exigir();
  if (!esUuid(id)) return { error: 'Serie no válida.' };
  // Cuenta todos los artículos, también los de la papelera (la base lo exige igual).
  const { count } = await supabase.from('articulos').select('id', { count: 'exact', head: true }).eq('serie_id', id);
  if ((count ?? 0) > 0) return { error: 'Esta serie tiene artículos: muévelos a otra serie antes de borrarla.' };
  const r = await supabase.from('series').delete().eq('id', id).select('id');
  if (r.error || !r.data?.length) return error(r.error, 'No se pudo borrar la serie.');
  redirect('/admin/articulos/series?aviso=serie-borrada');
}

export async function guardarTema(_: EstadoFormulario, d: FormData): Promise<EstadoFormulario> {
  const supabase = await exigir();
  const nombre = t(d, 'nombre').slice(0, 120);
  if (!nombre) return { error: 'El tema necesita un nombre.' };
  const id = t(d, 'id');
  const datos = { nombre, slug: slugDesde(nombre) };
  const r = esUuid(id)
    ? await supabase.from('temas').update(datos).eq('id', id).select('id')
    : await supabase.from('temas').insert(datos).select('id');
  if (r.error || !r.data?.length) return error(r.error, 'No se pudo guardar el tema.');
  redirect(`/admin/articulos/series?aviso=${esUuid(id) ? 'tema-editado' : 'tema-creado'}`);
}

export async function borrarTema(id: string): Promise<EstadoFormulario> {
  const supabase = await exigir();
  if (!esUuid(id)) return { error: 'Tema no válido.' };
  // Quitar un tema no borra artículos: solo deja de estar asociado.
  const r = await supabase.from('temas').delete().eq('id', id).select('id');
  if (r.error || !r.data?.length) return error(r.error, 'No se pudo borrar el tema.');
  redirect('/admin/articulos/series?aviso=tema-borrado');
}
