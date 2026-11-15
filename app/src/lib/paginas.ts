import 'server-only';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { configuracion } from './datos';
import { supabase } from './supabase';
import { vistaPreviaActiva } from './vista-previa';

export type ClavePagina = 'inicio' | 'nosotros' | 'eventos' | 'articulos' | 'galeria';

/** Claves de las páginas publicadas (RLS: el visitante solo ve esas). */
type FilaPagina = { clave: string; seo_titulo: string | null; seo_descripcion: string | null };

/** Páginas publicadas con su SEO (RLS: el visitante solo ve esas). Una sola consulta por visita. */
const filasDePaginas = cache(async (): Promise<FilaPagina[]> => {
  const r = await supabase().from('paginas').select('clave, seo_titulo, seo_descripcion');
  if (r.error) throw new Error(`No se pudieron leer las páginas: ${r.error.message}`);
  return (r.data ?? []) as FilaPagina[];
});

/** Claves de las páginas publicadas. */
export async function paginasPublicadas(): Promise<Set<string>> {
  return new Set((await filasDePaginas()).map((p) => p.clave));
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
  const { metadatos } = await import('./seo');
  const [paginas, conf] = await Promise.all([filasDePaginas(), configuracion()]);
  const pagina: Partial<FilaPagina> = paginas.find((p) => p.clave === clave) ?? {};
  const propio = Boolean(pagina.seo_titulo) || !nombre;
  return metadatos({
    titulo: pagina.seo_titulo || (nombre ?? conf.seo_titulo),
    tituloAbsoluto: propio,
    descripcion: pagina.seo_descripcion,
    ruta: clave === 'inicio' ? '/' : `/${clave}`,
  });
}
