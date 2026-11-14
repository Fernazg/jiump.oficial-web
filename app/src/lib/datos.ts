import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type {
  Actividad, Album, Articulo, Bloque, Configuracion, Enlace, FotoFirmada, Institucional, ItemMenu,
  SeccionActividad, SeccionPagina, Serie, Tema, Video,
} from './tipos';

/**
 * Consultas del sitio público. Todas usan la clave anónima, así que Supabase
 * (RLS) solo devuelve contenido publicado; aquí no se filtra «a mano» por
 * estado salvo para ordenar o agrupar.
 */

const COLUMNAS_ARTICULO =
  'id, titulo, slug, bajada, autor, serie_id, parte, portada_foto_id, cuerpo, estado, publicado_en, minutos_lectura';
const COLUMNAS_ACTIVIDAD =
  'id, titulo, slug, tipo, anio, fecha_inicio, fecha_precision, fecha_fin, lugar, zona, introduccion, portada_foto_id, destacar_inicio, orden_inicio, es_proximo, lema, cita_texto, cita_referencia, abreviatura';
const COLUMNAS_ALBUM = 'id, titulo, slug, descripcion, anio, pais, ciudad, actividad_id, portada_foto_id, orden';

/** Duración de las URL firmadas de las fotos (las páginas se generan en cada visita). */
const SEGUNDOS_URL_FIRMADA = 60 * 60;

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
  const { data, error } = await cliente
    .storage.from('fotos')
    .createSignedUrls(rutas, SEGUNDOS_URL_FIRMADA);
  if (error) throw new Error(`No se pudieron firmar las fotos: ${error.message}`);

  const porRuta = new Map((data ?? []).filter((d) => d.signedUrl && !d.error).map((d) => [d.path, d.signedUrl]));
  for (const f of fotos) {
    const anchos = [...(f.anchos ?? [])].sort((a, b) => a - b).filter((a) => porRuta.has(version(f.archivo, a, 'webp')) && porRuta.has(version(f.archivo, a, 'avif')));
    if (anchos.length) {
      const srcset = (formato: string) => anchos.map((a) => `${porRuta.get(version(f.archivo, a, formato))} ${a}w`).join(', ');
      mapa.set(f.id, { ...f, url: porRuta.get(version(f.archivo, anchos[anchos.length - 1], 'webp'))!, fuentes: { avif: srcset('avif'), webp: srcset('webp') } });
      continue;
    }
    const url = porRuta.get(f.archivo);
    if (url) mapa.set(f.id, { ...f, url });
  }
  return mapa;
}

// -----------------------------------------------------------------------------
// Sitio
// -----------------------------------------------------------------------------
export async function configuracion(): Promise<Configuracion> {
  const r = await supabase()
    .from('configuracion')
    .select('modo_mantenimiento, instagram_url, mostrar_barra_proximo_evento, seo_titulo, seo_descripcion, mantenimiento_foto_id')
    .maybeSingle();
  if (r.error) throw new Error(`No se pudo leer la configuración: ${r.error.message}`);
  return (r.data as Configuracion | null) ?? {
    modo_mantenimiento: false, instagram_url: null, mostrar_barra_proximo_evento: false, seo_titulo: null, seo_descripcion: null, mantenimiento_foto_id: null,
  };
}

export async function menu(): Promise<ItemMenu[]> {
  return filas<ItemMenu>(
    await supabase().from('menu').select('id, ubicacion, etiqueta, url, orden').order('orden'),
    'el menú',
  );
}

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

export async function institucional(): Promise<Institucional[]> {
  return filas<Institucional>(
    await supabase().from('institucional').select('id, tipo, titulo, texto, orden').order('orden'),
    'los textos institucionales',
  );
}

// -----------------------------------------------------------------------------
// Artículos
// -----------------------------------------------------------------------------
export async function series(): Promise<Serie[]> {
  return filas<Serie>(
    await supabase().from('series').select('id, nombre, slug, descripcion, tipo, mes, color, icono, orden').order('orden'),
    'las series',
  );
}

export async function temas(): Promise<Tema[]> {
  return filas<Tema>(await supabase().from('temas').select('id, nombre, slug').order('nombre'), 'los temas');
}

export async function articulos(opciones: { limite?: number } = {}): Promise<Articulo[]> {
  let q = supabase()
    .from('articulos')
    .select(COLUMNAS_ARTICULO)
    .order('publicado_en', { ascending: false, nullsFirst: false })
    .order('parte', { ascending: false, nullsFirst: false });
  if (opciones.limite) q = q.limit(opciones.limite);
  return filas<Articulo>(await q, 'los artículos');
}

export async function articulosDeTema(temaId: string): Promise<Articulo[]> {
  const r = await supabase()
    .from('articulos')
    .select(`${COLUMNAS_ARTICULO}, articulo_temas!inner(tema_id)`)
    .eq('articulo_temas.tema_id', temaId)
    .order('publicado_en', { ascending: false, nullsFirst: false });
  return filas<Articulo>(r, 'los artículos del tema');
}

export async function buscarArticulos(q: string): Promise<Articulo[]> {
  return filas<Articulo>(await supabase().rpc('buscar_articulos', { q }), 'la búsqueda');
}

export async function articuloPorSlug(slug: string): Promise<Articulo | null> {
  const r = await supabase().from('articulos').select(COLUMNAS_ARTICULO).eq('slug', slug).maybeSingle();
  if (r.error) throw new Error(`No se pudo leer el artículo: ${r.error.message}`);
  return r.data as Articulo | null;
}

// -----------------------------------------------------------------------------
// Actividades
// -----------------------------------------------------------------------------
export async function actividades(): Promise<Actividad[]> {
  return filas<Actividad>(
    await supabase()
      .from('actividades')
      .select(COLUMNAS_ACTIVIDAD)
      .order('anio', { ascending: false })
      .order('fecha_inicio', { ascending: false, nullsFirst: false })
      .order('orden_inicio'),
    'las actividades',
  );
}

export async function actividadPorSlug(slug: string): Promise<Actividad | null> {
  const r = await supabase().from('actividades').select(COLUMNAS_ACTIVIDAD).eq('slug', slug).maybeSingle();
  if (r.error) throw new Error(`No se pudo leer la actividad: ${r.error.message}`);
  return r.data as Actividad | null;
}

export async function detalleActividad(id: string) {
  const [secciones, enlaces, fotos, videos, albumes] = await Promise.all([
    supabase().from('actividad_secciones').select('id, titulo, contenido, orden').eq('actividad_id', id).order('orden'),
    supabase().from('actividad_enlaces').select('id, url, titulo, orden').eq('actividad_id', id).order('orden'),
    supabase().from('actividad_fotos').select('foto_id, orden, es_portada').eq('actividad_id', id).order('orden'),
    supabase().from('videos').select('id, url, titulo, descripcion, album_id, actividad_id').eq('actividad_id', id).order('orden'),
    supabase().from('albumes').select(COLUMNAS_ALBUM).eq('actividad_id', id).order('orden'),
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
export async function albumes(): Promise<(Album & { fotoIds: string[] })[]> {
  const lista = filas<Album>(
    await supabase().from('albumes').select(COLUMNAS_ALBUM).order('orden'),
    'los álbumes',
  );
  if (lista.length === 0) return [];
  const rel = filas<{ album_id: string; foto_id: string; orden: number }>(
    await supabase().from('album_fotos').select('album_id, foto_id, orden').in('album_id', lista.map((a) => a.id)).order('orden'),
    'las fotos de los álbumes',
  );
  return lista.map((a) => ({ ...a, fotoIds: rel.filter((r) => r.album_id === a.id).map((r) => r.foto_id) }));
}

export async function videosDeAlbum(albumId: string): Promise<Video[]> {
  return filas<Video>(
    await supabase().from('videos').select('id, url, titulo, descripcion, album_id, actividad_id').eq('album_id', albumId).order('orden'),
    'los videos del álbum',
  );
}

// -----------------------------------------------------------------------------
// Utilidades sobre bloques
// -----------------------------------------------------------------------------
export function fotosDeBloques(bloques: Bloque[] | null | undefined): string[] {
  return (bloques ?? []).flatMap((b) => (b.tipo === 'imagen' && b.foto_id ? [b.foto_id] : []));
}
