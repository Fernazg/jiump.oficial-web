import 'server-only';
import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { leerTodo } from './leer-todo';
import { supabase } from './supabase';
import type {
  Actividad, Album, Articulo, Bloque, Configuracion, Enlace, FotoFirmada, Institucional, ItemMenu,
  SeccionActividad, SeccionPagina, Serie, Tema, Video,
} from './tipos';

/**
 * Consultas del sitio público. Todas usan la clave anónima, así que Supabase
 * (RLS) solo devuelve contenido publicado; aquí no se filtra «a mano» por
 * estado salvo para ordenar o agrupar.
 *
 * Rendimiento: las lecturas que usan varias partes de una misma página (menú,
 * configuración, páginas publicadas, artículos…) van envueltas en `cache()` de
 * React: dentro de UNA visita se consultan una sola vez. No se guarda nada
 * entre visitas: publicar o retirar contenido se nota al instante.
 */

/** Para listados y tarjetas: sin el cuerpo, que es lo más pesado de un artículo. */
const COLUMNAS_TARJETA = 'id, titulo, slug, bajada, autor, serie_id, parte, portada_foto_id, estado, publicado_en, minutos_lectura';
const COLUMNAS_RESUMEN = `${COLUMNAS_TARJETA}, actualizado_en`;
/** Para la página del artículo: con el cuerpo completo. */
const COLUMNAS_ARTICULO = `${COLUMNAS_RESUMEN}, cuerpo`;
const COLUMNAS_ACTIVIDAD =
  'id, titulo, slug, tipo, anio, fecha_inicio, fecha_precision, fecha_fin, lugar, zona, introduccion, portada_foto_id, destacar_inicio, orden_inicio, es_proximo, lema, cita_texto, cita_referencia, abreviatura, actualizado_en';
const COLUMNAS_ALBUM = 'id, titulo, slug, descripcion, anio, pais, ciudad, actividad_id, portada_foto_id, orden, actualizado_en';

/**
 * URL firmadas de las fotos públicas.
 *
 * Cada firma genera una dirección distinta. Si se firmara en cada visita, el
 * navegador nunca reconocería una foto que ya descargó y la bajaría de nuevo en
 * cada página. Por eso las firmas del sitio público se guardan en memoria y se
 * reutilizan durante una hora: la misma foto mantiene su dirección y el
 * navegador la toma de su caché.
 *
 * En Cloudflare, cada página pública se guarda ya armada hasta 24 horas (ver
 * paginas-guardadas.ts), con las direcciones de sus fotos adentro. Por eso la
 * firma pública dura 26 horas: una dirección entregada siempre sirve al menos
 * 25 horas más, más que cualquier página guardada.
 *
 * Si una foto se retira, deja de aparecer en el sitio al instante (cambia la
 * versión del contenido y la página se arma de nuevo, y la consulta a «fotos»
 * pasa por RLS). Solo quien ya tenía su dirección puede seguir abriéndola
 * hasta que venza (como máximo 26 horas).
 *
 * Las vistas previas del panel no usan esta memoria: firman con la sesión de
 * la persona, que ve fotos aún no publicadas, y por solo dos horas.
 */
const SEGUNDOS_URL_FIRMADA_PUBLICA = 26 * 60 * 60;
const SEGUNDOS_URL_FIRMADA_PANEL = 2 * 60 * 60;
const MS_REUTILIZAR_FIRMA = 60 * 60 * 1000;
const MAX_FIRMAS_EN_MEMORIA = 20_000;
const firmasPublicas = new Map<string, { url: string; hasta: number }>();

async function firmarRutas(rutas: string[], cliente: SupabaseClient, publico: boolean): Promise<Map<string, string>> {
  const ahora = Date.now();
  const listas = new Map<string, string>();
  const pendientes: string[] = [];
  for (const ruta of rutas) {
    const guardada = publico ? firmasPublicas.get(ruta) : undefined;
    if (guardada && guardada.hasta > ahora) listas.set(ruta, guardada.url);
    else pendientes.push(ruta);
  }
  if (pendientes.length === 0) return listas;

  const { data, error } = await cliente.storage.from('fotos').createSignedUrls(pendientes, publico ? SEGUNDOS_URL_FIRMADA_PUBLICA : SEGUNDOS_URL_FIRMADA_PANEL);
  if (error) throw new Error(`No se pudieron firmar las fotos: ${error.message}`);
  if (publico && firmasPublicas.size > MAX_FIRMAS_EN_MEMORIA) {
    for (const [ruta, f] of firmasPublicas) if (f.hasta <= ahora) firmasPublicas.delete(ruta);
    if (firmasPublicas.size > MAX_FIRMAS_EN_MEMORIA) firmasPublicas.clear();
  }
  for (const d of data ?? []) {
    if (!d.path || !d.signedUrl || d.error) continue;
    listas.set(d.path, d.signedUrl);
    if (publico) firmasPublicas.set(d.path, { url: d.signedUrl, hasta: ahora + MS_REUTILIZAR_FIRMA });
  }
  return listas;
}

function filas<T>(resultado: { data: unknown; error: { message: string } | null }, que: string): T[] {
  if (resultado.error) throw new Error(`No se pudo leer ${que}: ${resultado.error.message}`);
  return (resultado.data ?? []) as T[];
}

// -----------------------------------------------------------------------------
// Fotos: solo las publicadas (RLS) y con URL firmada (bucket privado)
// -----------------------------------------------------------------------------
/**
 * Firma las fotos con el cliente indicado: por defecto el anónimo del sitio
 * (solo fotos publicadas). La vista previa del panel pasa el cliente con la
 * sesión de la persona, que también ve las fotos aún no publicadas.
 */
export async function firmarFotos(
  ids: Iterable<string | null | undefined>,
  cliente: SupabaseClient = supabase(),
): Promise<Map<string, FotoFirmada>> {
  const unicos = [...new Set([...ids].filter((x): x is string => Boolean(x)))];
  const mapa = new Map<string, FotoFirmada>();
  if (unicos.length === 0) return mapa;

  const fotos = filas<Omit<FotoFirmada, 'url'>>(
    await cliente.from('fotos').select('id, archivo, ancho, alto, texto_alternativo, credito, anchos').in('id', unicos),
    'fotos',
  );
  if (fotos.length === 0) return mapa;

  // Original + versiones optimizadas (<carpeta>/<nombre>/<ancho>.webp|avif).
  const version = (archivo: string, ancho: number, formato: string) => `${archivo.replace(/\.[^./]+$/, '')}/${ancho}.${formato}`;
  const rutas = fotos.flatMap((f) => [f.archivo, ...(f.anchos ?? []).flatMap((a) => [version(f.archivo, a, 'webp'), version(f.archivo, a, 'avif')])]);
  const porRuta = await firmarRutas(rutas, cliente, cliente === supabase());
  for (const f of fotos) {
    const anchos = [...(f.anchos ?? [])].sort((a, b) => a - b).filter((a) => porRuta.has(version(f.archivo, a, 'webp')) && porRuta.has(version(f.archivo, a, 'avif')));
    if (anchos.length) {
      const srcset = (formato: string) => anchos.map((a) => `${porRuta.get(version(f.archivo, a, formato))} ${a}w`).join(', ');
      mapa.set(f.id, { ...f, url: porRuta.get(version(f.archivo, anchos[anchos.length - 1], 'webp'))!, fuentes: { avif: srcset('avif'), webp: srcset('webp') }, original: porRuta.get(f.archivo) });
      continue;
    }
    const url = porRuta.get(f.archivo);
    if (url) mapa.set(f.id, { ...f, url, original: url });
  }
  return mapa;
}

// -----------------------------------------------------------------------------
// Sitio
// -----------------------------------------------------------------------------
export const configuracion = cache(async (): Promise<Configuracion> => {
  const r = await supabase()
    .from('configuracion')
    .select('modo_mantenimiento, instagram_url, mostrar_barra_proximo_evento, seo_titulo, seo_descripcion, seo_foto_id, mantenimiento_foto_id')
    .maybeSingle();
  if (r.error) throw new Error(`No se pudo leer la configuración: ${r.error.message}`);
  return (r.data as Configuracion | null) ?? {
    modo_mantenimiento: false, instagram_url: null, mostrar_barra_proximo_evento: false, seo_titulo: null, seo_descripcion: null, seo_foto_id: null, mantenimiento_foto_id: null,
  };
});

export const menu = cache(async (): Promise<ItemMenu[]> => {
  return filas<ItemMenu>(
    await supabase().from('menu').select('id, ubicacion, etiqueta, url, orden').order('orden'),
    'el menú',
  );
});

/** Secciones visibles de una página publicada (vacío si la página está en borrador). */
export async function seccionesDePagina(clave: string): Promise<SeccionPagina[]> {
  return filas<SeccionPagina>(
    await supabase()
      .from('secciones')
      .select('id, tipo, orden, contenido, paginas!inner(clave)')
      .eq('paginas.clave', clave)
      .order('orden'),
    'las secciones',
  );
}

export const institucional = cache(async (): Promise<Institucional[]> => {
  return filas<Institucional>(
    await supabase().from('institucional').select('id, tipo, titulo, texto, orden').order('orden'),
    'los textos institucionales',
  );
});

// -----------------------------------------------------------------------------
// Artículos
// -----------------------------------------------------------------------------
export const series = cache(async (): Promise<Serie[]> => {
  return filas<Serie>(
    await supabase().from('series').select('id, nombre, slug, descripcion, tipo, mes, color, icono, orden').order('orden'),
    'las series',
  );
});

export async function temas(): Promise<Tema[]> {
  return filas<Tema>(await supabase().from('temas').select('id, nombre, slug').order('nombre'), 'los temas');
}

/** Todos los artículos visibles, sin el cuerpo (listados, tarjetas y navegación de la serie). */
export const articulos = cache(async (): Promise<Articulo[]> => {
  return filas<Articulo>(
    await supabase()
      .from('articulos')
      .select(COLUMNAS_RESUMEN)
      .order('publicado_en', { ascending: false, nullsFirst: false })
      .order('parte', { ascending: false, nullsFirst: false }),
    'los artículos',
  );
});

export async function articulosDeTema(temaId: string): Promise<Articulo[]> {
  const r = await supabase()
    .from('articulos')
    .select(`${COLUMNAS_RESUMEN}, articulo_temas!inner(tema_id)`)
    .eq('articulo_temas.tema_id', temaId)
    .order('publicado_en', { ascending: false, nullsFirst: false });
  return filas<Articulo>(r, 'los artículos del tema');
}

export async function buscarArticulos(q: string): Promise<Articulo[]> {
  return filas<Articulo>(await supabase().rpc('buscar_articulos', { q }).select(COLUMNAS_TARJETA), 'la búsqueda');
}

export const articuloPorSlug = cache(async (slug: string): Promise<Articulo | null> => {
  const r = await supabase().from('articulos').select(COLUMNAS_ARTICULO).eq('slug', slug).maybeSingle();
  if (r.error) throw new Error(`No se pudo leer el artículo: ${r.error.message}`);
  return r.data as Articulo | null;
});

// -----------------------------------------------------------------------------
// Actividades
// -----------------------------------------------------------------------------
export const actividades = cache(async (): Promise<Actividad[]> => {
  return filas<Actividad>(
    await supabase()
      .from('actividades')
      .select(COLUMNAS_ACTIVIDAD)
      .order('anio', { ascending: false })
      .order('fecha_inicio', { ascending: false, nullsFirst: false })
      .order('orden_inicio'),
    'las actividades',
  );
});

export const actividadPorSlug = cache(async (slug: string): Promise<Actividad | null> => {
  const r = await supabase().from('actividades').select(COLUMNAS_ACTIVIDAD).eq('slug', slug).maybeSingle();
  if (r.error) throw new Error(`No se pudo leer la actividad: ${r.error.message}`);
  return r.data as Actividad | null;
});

export async function detalleActividad(id: string, cliente: SupabaseClient = supabase()) {
  const [secciones, enlaces, fotos, videos, albumes] = await Promise.all([
    cliente.from('actividad_secciones').select('id, titulo, contenido, orden').eq('actividad_id', id).order('orden'),
    cliente.from('actividad_enlaces').select('id, url, titulo, orden').eq('actividad_id', id).order('orden'),
    cliente.from('actividad_fotos').select('foto_id, orden, es_portada').eq('actividad_id', id).order('orden'),
    cliente.from('videos').select('id, url, titulo, descripcion, album_id, actividad_id').eq('actividad_id', id).order('orden'),
    cliente.from('albumes').select(COLUMNAS_ALBUM).eq('actividad_id', id).order('orden'),
  ]);
  return {
    secciones: filas<SeccionActividad>(secciones, 'las secciones de la actividad'),
    enlaces: filas<Enlace>(enlaces, 'los enlaces de la actividad'),
    fotoIds: filas<{ foto_id: string }>(fotos, 'las fotos de la actividad').map((f) => f.foto_id),
    videos: filas<Video>(videos, 'los videos de la actividad'),
    albumes: filas<Album>(albumes, 'los álbumes de la actividad'),
  };
}

// -----------------------------------------------------------------------------
// Galería
// -----------------------------------------------------------------------------
export const albumes = cache(async (): Promise<(Album & { fotoIds: string[] })[]> => {
  const lista = filas<Album>(
    await supabase().from('albumes').select(COLUMNAS_ALBUM).order('orden'),
    'los álbumes',
  );
  if (lista.length === 0) return [];
  // Por tramos: una consulta sola se corta en 1.000 filas sin avisar.
  const rel = await leerTodo<{ album_id: string; foto_id: string; orden: number }>(
    (d, h) => supabase().from('album_fotos').select('album_id, foto_id, orden').in('album_id', lista.map((a) => a.id)).order('orden').order('album_id').order('foto_id').range(d, h),
    'las fotos de los álbumes',
  );
  return lista.map((a) => ({ ...a, fotoIds: rel.filter((r) => r.album_id === a.id).map((r) => r.foto_id) }));
});

export async function videosDeAlbum(albumId: string, cliente: SupabaseClient = supabase()): Promise<Video[]> {
  return filas<Video>(
    await cliente.from('videos').select('id, url, titulo, descripcion, album_id, actividad_id').eq('album_id', albumId).order('orden'),
    'los videos del álbum',
  );
}

// -----------------------------------------------------------------------------
// Utilidades sobre bloques
// -----------------------------------------------------------------------------
export function fotosDeBloques(bloques: Bloque[] | null | undefined): string[] {
  return (bloques ?? []).flatMap((b) => (b.tipo === 'imagen' && b.foto_id ? [b.foto_id] : []));
}
