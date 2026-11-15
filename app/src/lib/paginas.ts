import 'server-only';
import { notFound } from 'next/navigation';
import { supabase } from './supabase';
import { vistaPreviaActiva } from './vista-previa';

export type ClavePagina = 'inicio' | 'nosotros' | 'eventos' | 'articulos' | 'galeria';

/** Claves de las páginas publicadas (RLS: el visitante solo ve esas). */
export async function paginasPublicadas(): Promise<Set<string>> {
  const r = await supabase().from('paginas').select('clave');
  if (r.error) throw new Error(`No se pudieron leer las páginas: ${r.error.message}`);
  return new Set((r.data ?? []).map((p: { clave: string }) => p.clave));
}

/**
 * Una página completa solo se muestra si está publicada; si no, 404.
 * En vista previa local se muestra igual, con un aviso.
 */
export async function exigirPagina(clave: ClavePagina): Promise<{ vistaPrevia: boolean }> {
  if ((await paginasPublicadas()).has(clave)) return { vistaPrevia: false };
  if (vistaPreviaActiva()) return { vistaPrevia: true };
  notFound();
}

/**
 * SEO de una página: el suyo (Administrar página web) o, si falta, el de
 * Configuración. Sin ninguno, se usan el nombre y el lema del sitio.
 */
export async function metadataDePagina(clave: ClavePagina, nombre: string | null): Promise<import('next').Metadata> {
  const [p, c] = await Promise.all([
    supabase().from('paginas').select('seo_titulo, seo_descripcion').eq('clave', clave).maybeSingle(),
    supabase().from('configuracion').select('seo_titulo, seo_descripcion').maybeSingle(),
  ]);
  const pagina = (p.data ?? {}) as { seo_titulo?: string | null; seo_descripcion?: string | null };
  const conf = (c.data ?? {}) as { seo_titulo?: string | null; seo_descripcion?: string | null };
  const titulo = pagina.seo_titulo || (nombre ?? conf.seo_titulo);
  const descripcion = pagina.seo_descripcion || conf.seo_descripcion;
  return {
    ...(titulo ? { title: pagina.seo_titulo || !nombre ? { absolute: titulo } : titulo } : {}),
    ...(descripcion ? { description: descripcion } : {}),
  };
}
