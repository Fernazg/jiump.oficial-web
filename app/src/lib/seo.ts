import 'server-only';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { cache } from 'react';
import { configuracion, firmarFotos } from './datos';
import { recortar } from './formato';
import type { Bloque, FotoFirmada } from './tipos';

/**
 * SEO del sitio público: dirección canónica, Open Graph (cómo se ve un enlace
 * al compartirlo) y datos estructurados para buscadores. Solo usa datos que ya
 * están en la base: si algo falta, se omite; nunca se completa con textos propios.
 */
export const NOMBRE_SITIO = 'JIUMP';
export const IDIOMA = 'es-CL';

/**
 * Dirección pública del sitio, sin barra final (ej.: https://jiump.cl).
 * Se configura con la variable SITIO_URL. Si falta (desarrollo, pruebas), se
 * usa la dirección con la que llegó la visita.
 */
export const urlSitio = cache(async (): Promise<string> => {
  const fija = process.env.SITIO_URL?.trim().replace(/\/+$/, '');
  if (fija && /^https?:\/\/[^\s/]+$/.test(fija)) return fija;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const local = /^(localhost|127\.)/.test(host);
  return `${h.get('x-forwarded-proto') ?? (local ? 'http' : 'https')}://${host}`;
});

/** Foto para compartir: el original (JPG o PNG), que todas las redes aceptan. */
export async function fotoParaCompartir(id: string | null | undefined): Promise<FotoFirmada | undefined> {
  if (!id) return undefined;
  return (await firmarFotos([id])).get(id);
}

/** Foto por defecto al compartir (Configuración › SEO). */
export const fotoPorDefecto = cache(async (): Promise<FotoFirmada | undefined> => fotoParaCompartir((await configuracion()).seo_foto_id));

/** Descripción corta a partir del propio texto (primer párrafo), si no hay bajada. */
export function resumenDeBloques(bloques: Bloque[] | null | undefined): string | undefined {
  for (const b of bloques ?? []) {
    if ((b.tipo === 'entradilla' || b.tipo === 'parrafo') && b.texto?.trim()) {
      return recortar(b.texto.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(), 155);
    }
  }
  return undefined;
}

/**
 * Metadatos de una página: título, descripción, dirección canónica y Open Graph.
 * `ruta` es la dirección propia de la página (sin parámetros de búsqueda).
 */
export async function metadatos({ titulo, tituloAbsoluto = false, descripcion, ruta, foto, tipo = 'website', publicado, indexar = true }: {
  titulo?: string | null; tituloAbsoluto?: boolean; descripcion?: string | null; ruta: string;
  foto?: FotoFirmada; tipo?: 'website' | 'article'; publicado?: string | null; indexar?: boolean;
}): Promise<Metadata> {
  const [base, conf, porDefecto] = await Promise.all([urlSitio(), configuracion(), foto ? undefined : fotoPorDefecto()]);
  const desc = descripcion?.trim() || conf.seo_descripcion || undefined;
  const imagen = foto ?? porDefecto;
  const url = `${base}${ruta === '/' ? '' : ruta}` || base;
  const tituloOg = titulo ?? conf.seo_titulo ?? NOMBRE_SITIO;
  const imagenes = imagen
    ? [{ url: imagen.original ?? imagen.url, alt: imagen.texto_alternativo, ...(imagen.ancho && imagen.alto ? { width: imagen.ancho, height: imagen.alto } : {}) }]
    : undefined;
  return {
    ...(titulo ? { title: tituloAbsoluto ? { absolute: titulo } : titulo } : {}),
    ...(desc ? { description: desc } : {}),
    alternates: { canonical: url },
    ...(indexar ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      type: tipo, url, siteName: NOMBRE_SITIO, locale: 'es_CL', title: tituloOg,
      ...(desc ? { description: desc } : {}),
      ...(imagenes ? { images: imagenes } : {}),
      ...(tipo === 'article' && publicado ? { publishedTime: publicado } : {}),
    },
    twitter: { card: imagenes ? 'summary_large_image' : 'summary', title: tituloOg, ...(desc ? { description: desc } : {}), ...(imagenes ? { images: imagenes.map((i) => i.url) } : {}) },
  };
}

/** Quita las claves vacías: un dato que no existe no se publica. */
export function sinVacios<T extends Record<string, unknown>>(objeto: T): Partial<T> {
  return Object.fromEntries(Object.entries(objeto).filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))) as Partial<T>;
}
