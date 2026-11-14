import type { SeccionPagina } from './tipos';

/**
 * Lectura segura del `contenido jsonb` de las secciones de página (editadas
 * desde el panel). Si un campo falta o tiene otro tipo, se trata como vacío:
 * el sitio nunca completa con textos propios.
 */
export const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
export const lista = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
export const objeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export const seccion = (secciones: SeccionPagina[], tipo: string) => secciones.find((s) => s.tipo === tipo);

export type Boton = { texto: string; url: string };
export function boton(v: unknown): Boton | null {
  const o = objeto(v);
  const t = texto(o.texto);
  const u = texto(o.url);
  return t && u && /^(\/|https:\/\/)/.test(u) ? { texto: t, url: u } : null;
}

/** ids de fotos referenciadas en el contenido de las secciones. */
export function fotosDeSecciones(secciones: SeccionPagina[]): string[] {
  const ids: string[] = [];
  const recorrer = (v: unknown, clave?: string) => {
    if (typeof v === 'string' && (clave === 'foto_id' || clave === 'fotos')) ids.push(v);
    else if (Array.isArray(v)) v.forEach((x) => recorrer(x, clave));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => recorrer(x, k));
  };
  secciones.forEach((s) => recorrer(s.contenido));
  return ids;
}
