import 'server-only';
import { firmarMiniaturas, type FotoElegible } from './fotos';
import { clientePanel } from './supabase-panel';

/** Galerías, álbumes y videos (Superadmin y Multimedia; RLS lo exige). */

export type AlbumPanel = {
  id: string; titulo: string; slug: string; descripcion: string | null; anio: number | null;
  pais: string | null; ciudad: string | null; actividad_id: string | null; portada_foto_id: string | null;
  estado: 'borrador' | 'publicado' | 'archivado'; orden: number; actualizado_en: string;
};
const COLUMNAS_ALBUM = 'id, titulo, slug, descripcion, anio, pais, ciudad, actividad_id, portada_foto_id, estado, orden, actualizado_en';

export async function listarAlbumes(): Promise<(AlbumPanel & { fotos: number; actividad: string | null })[]> {
  const supabase = await clientePanel();
  const { data, error } = await supabase.from('albumes').select(`${COLUMNAS_ALBUM}, album_fotos(count), actividades(titulo)`).order('orden').order('titulo');
  if (error) throw new Error(`No se pudieron leer los álbumes: ${error.message}`);
  return ((data ?? []) as unknown as (AlbumPanel & { album_fotos: { count: number }[]; actividades: { titulo: string } | null })[])
    .map(({ album_fotos, actividades, ...a }) => ({ ...a, fotos: album_fotos?.[0]?.count ?? 0, actividad: actividades?.titulo ?? null }));
}

export async function albumParaEditar(id: string) {
  const supabase = await clientePanel();
  const [a, f] = await Promise.all([
    supabase.from('albumes').select(COLUMNAS_ALBUM).eq('id', id).maybeSingle(),
    supabase.from('album_fotos').select('foto_id').eq('album_id', id).order('orden'),
  ]);
  if (!a.data) return null;
  return { album: a.data as AlbumPanel, fotos: ((f.data ?? []) as { foto_id: string }[]).map((x) => x.foto_id) };
}

/** Actividades que la persona puede ver (Multimedia: solo las publicadas). */
export async function actividadesVisibles(): Promise<{ id: string; titulo: string; anio: number; estado: string }[]> {
  const supabase = await clientePanel();
  const { data } = await supabase.from('actividades').select('id, titulo, anio, estado').order('anio', { ascending: false }).order('titulo');
  return (data ?? []) as { id: string; titulo: string; anio: number; estado: string }[];
}

export type FotoCatalogo = FotoElegible & { actividad_id: string | null; album_id: string | null };

/** Todas las fotos con su evento actual (para respetar la regla 2 al elegir). */
export async function catalogoFotos(): Promise<FotoCatalogo[]> {
  const supabase = await clientePanel();
  const [{ data: fotos }, { data: enActividad }, { data: enAlbum }] = await Promise.all([
    supabase.from('fotos').select('id, archivo, anchos, texto_alternativo, ancho, alto').order('creado_en', { ascending: false }),
    supabase.from('actividad_fotos').select('foto_id, actividad_id'),
    supabase.from('album_fotos').select('foto_id, album_id'),
  ]);
  const act = new Map(((enActividad ?? []) as { foto_id: string; actividad_id: string }[]).map((x) => [x.foto_id, x.actividad_id]));
  const alb = new Map(((enAlbum ?? []) as { foto_id: string; album_id: string }[]).map((x) => [x.foto_id, x.album_id]));
  const lista = (fotos ?? []) as { id: string; archivo: string; anchos: number[]; texto_alternativo: string; ancho: number | null; alto: number | null }[];
  const urls = await firmarMiniaturas(supabase, lista);
  return lista.map((x) => ({
    id: x.id, url: urls.get(x.archivo) ?? '', texto_alternativo: x.texto_alternativo, ancho: x.ancho, alto: x.alto,
    actividad_id: act.get(x.id) ?? null, album_id: alb.get(x.id) ?? null,
  }));
}

export type VideoPanel = {
  id: string; url: string; titulo: string; descripcion: string | null; album_id: string | null; actividad_id: string | null;
  estado: 'borrador' | 'publicado' | 'archivado'; orden: number; actualizado_en: string;
};

export async function listarVideos(): Promise<(VideoPanel & { donde: string | null })[]> {
  const supabase = await clientePanel();
  const { data, error } = await supabase.from('videos')
    .select('id, url, titulo, descripcion, album_id, actividad_id, estado, orden, actualizado_en, albumes(titulo), actividades(titulo)').order('orden').order('titulo');
  if (error) throw new Error(`No se pudieron leer los videos: ${error.message}`);
  return ((data ?? []) as unknown as (VideoPanel & { albumes: { titulo: string } | null; actividades: { titulo: string } | null })[])
    .map(({ albumes, actividades, ...v }) => ({ ...v, donde: albumes?.titulo ? `Álbum · ${albumes.titulo}` : actividades?.titulo ? `Actividad · ${actividades.titulo}` : null }));
}
