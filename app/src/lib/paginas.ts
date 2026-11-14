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
