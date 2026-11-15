import 'server-only';
import { CATALOGO, type ClavePaginaWeb } from '@/lib/catalogo-secciones';
import type { ItemInstitucional, ItemMenuEditable, SeccionEditable } from './acciones-sitio';
import { cambiosPendientes, vistaPreviaContenidoAlDia } from './eventos';
import { clientePanel } from './supabase-panel';

/**
 * Lectura para el panel de «Página web», «Menú y pie» e «Información
 * institucional» (solo Superadmin; RLS lo exige). Si hay cambios pendientes,
 * el editor muestra esos cambios; el sitio sigue con lo publicado.
 */
export const ID_CONJUNTO = '00000000-0000-0000-0000-000000000000';

export type PaginaPanel = {
  id: string; clave: ClavePaginaWeb; titulo: string; estado: 'borrador' | 'publicado' | 'archivado';
  seo_titulo: string | null; seo_descripcion: string | null; actualizado_en: string;
};

export async function listarPaginas(): Promise<PaginaPanel[]> {
  const supabase = await clientePanel();
  const { data } = await supabase.from('paginas').select('id, clave, titulo, estado, seo_titulo, seo_descripcion, actualizado_en');
  return (data ?? []) as PaginaPanel[];
}

/** Completa con el catálogo: toda página tiene todos sus tipos (los que falten, ocultos al final). */
function completar(clave: ClavePaginaWeb, secciones: SeccionEditable[]): SeccionEditable[] {
  const conocidos = new Set(CATALOGO[clave].map((t) => t.tipo));
  const lista = secciones.filter((s) => conocidos.has(s.tipo));
  for (const t of CATALOGO[clave]) if (!lista.some((s) => s.tipo === t.tipo)) lista.push({ tipo: t.tipo, visible: false, contenido: {} });
  return lista;
}

export async function paginaParaEditar(clave: ClavePaginaWeb) {
  const supabase = await clientePanel();
  const { data: pagina } = await supabase.from('paginas').select('id, clave, titulo, estado, seo_titulo, seo_descripcion, actualizado_en').eq('clave', clave).maybeSingle();
  if (!pagina) return null;
  const p = pagina as PaginaPanel;
  const cambios = p.estado === 'publicado' ? await cambiosPendientes('pagina', p.id) : null;
  let datos: { seo_titulo: string; seo_descripcion: string; secciones: SeccionEditable[] };
  if (cambios) {
    const d = cambios.datos as { seo_titulo?: string; seo_descripcion?: string; secciones?: SeccionEditable[] };
    datos = { seo_titulo: d.seo_titulo ?? '', seo_descripcion: d.seo_descripcion ?? '', secciones: d.secciones ?? [] };
  } else {
    const { data: secs } = await supabase.from('secciones').select('tipo, visible, contenido, orden').eq('pagina_id', p.id).order('orden');
    datos = {
      seo_titulo: p.seo_titulo ?? '', seo_descripcion: p.seo_descripcion ?? '',
      secciones: ((secs ?? []) as (SeccionEditable & { orden: number })[]).map(({ tipo, visible, contenido }) => ({ tipo, visible, contenido: contenido ?? {} })),
    };
  }
  datos.secciones = completar(clave, datos.secciones);
  return {
    pagina: p, datos, hayCambios: Boolean(cambios),
    version: cambios?.actualizado_en ?? p.actualizado_en,
    previaAlDia: await vistaPreviaContenidoAlDia('pagina', p.id),
  };
}

export async function menuParaEditar() {
  const supabase = await clientePanel();
  const cambios = await cambiosPendientes('menu', ID_CONJUNTO);
  let items: ItemMenuEditable[];
  if (cambios) items = ((cambios.datos as { items?: ItemMenuEditable[] }).items ?? []);
  else {
    const { data } = await supabase.from('menu').select('ubicacion, etiqueta, url, visible, orden').order('orden');
    items = ((data ?? []) as (ItemMenuEditable & { orden: number })[]).map(({ ubicacion, etiqueta, url, visible }) => ({ ubicacion, etiqueta, url, visible }));
  }
  return { items, hayCambios: Boolean(cambios), version: cambios?.actualizado_en ?? 'epoch', previaAlDia: await vistaPreviaContenidoAlDia('menu', ID_CONJUNTO) };
}

export async function institucionalParaEditar() {
  const supabase = await clientePanel();
  const cambios = await cambiosPendientes('institucional', ID_CONJUNTO);
  let items: ItemInstitucional[];
  if (cambios) items = ((cambios.datos as { items?: ItemInstitucional[] }).items ?? []);
  else {
    const { data } = await supabase.from('institucional').select('tipo, titulo, texto, orden').order('orden');
    items = ((data ?? []) as (ItemInstitucional & { orden: number; texto: string | null })[]).map(({ tipo, titulo, texto }) => ({ tipo, titulo, texto: texto ?? '' }));
  }
  return { items, hayCambios: Boolean(cambios), version: cambios?.actualizado_en ?? 'epoch', previaAlDia: await vistaPreviaContenidoAlDia('institucional', ID_CONJUNTO) };
}
