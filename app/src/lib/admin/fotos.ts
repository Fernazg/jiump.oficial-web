import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Acceso } from './acceso';
import { clientePanel } from './supabase-panel';

/**
 * Biblioteca de fotos del panel. Todo el equipo ve todas las fotos (para
 * usarlas); editar o borrar depende del rol (docs/roles-permisos.md, ◐):
 * Superadmin y Multimedia todas, Editor y Eventos solo las que subieron.
 */
export type UsoFoto = { tipo: string; titulo: string | null; publicado: boolean; enlace: string | null };
export type FotoPanel = {
  id: string;
  archivo: string;
  ancho: number | null;
  alto: number | null;
  texto_alternativo: string;
  credito: string | null;
  anchos: number[];
  creado_por: string | null;
  creado_en: string;
  url: string;
  usos: UsoFoto[];
  propia: boolean;
  gestionable: boolean;
  album: { id: string; titulo: string } | null;
  actividad: { id: string; titulo: string } | null;
};

/** Ruta de la versión optimizada: «carpeta/nombre.jpg» → «carpeta/nombre/480.webp». */
export const rutaVersion = (archivo: string, ancho: number, formato: 'webp' | 'avif') =>
  `${archivo.replace(/\.[^./]+$/, '')}/${ancho}.${formato}`;

export const gestionaTodas = (acceso: Acceso) => acceso.efectivos.some((r) => r === 'superadmin' || r === 'multimedia');

/** Miniatura: la versión WebP más chica si existe; si no, el original. */
export async function firmarMiniaturas(supabase: SupabaseClient, fotos: { archivo: string; anchos: number[] }[], ancho = 480) {
  const rutas = fotos.map((f) => (f.anchos.length ? rutaVersion(f.archivo, f.anchos.find((a) => a >= ancho) ?? f.anchos[f.anchos.length - 1], 'webp') : f.archivo));
  const mapa = new Map<string, string>();
  if (!rutas.length) return mapa;
  const { data } = await supabase.storage.from('fotos').createSignedUrls(rutas, 3600);
  (data ?? []).forEach((d, i) => { if (d.signedUrl) mapa.set(fotos[i].archivo, d.signedUrl); });
  return mapa;
}

export type FiltrosFotos = { q?: string; filtro?: string; album?: string };

export async function listarFotos(acceso: Acceso, f: FiltrosFotos = {}): Promise<FotoPanel[]> {
  const supabase = await clientePanel();
  const [{ data, error }, { data: enAlbum }, { data: enActividad }] = await Promise.all([
    supabase.from('fotos').select('id, archivo, ancho, alto, texto_alternativo, credito, anchos, creado_por, creado_en').order('creado_en', { ascending: false }),
    supabase.from('album_fotos').select('foto_id, albumes(id, titulo)'),
    supabase.from('actividad_fotos').select('foto_id, actividades(id, titulo)'),
  ]);
  if (error) throw new Error(`No se pudo leer la biblioteca: ${error.message}`);
  type Fila = Omit<FotoPanel, 'url' | 'usos' | 'propia' | 'gestionable' | 'album' | 'actividad'>;
  let fotos = (data ?? []) as Fila[];

  const albumDe = new Map(((enAlbum ?? []) as unknown as { foto_id: string; albumes: { id: string; titulo: string } | null }[])
    .filter((x) => x.albumes).map((x) => [x.foto_id, x.albumes!]));
  const actividadDe = new Map(((enActividad ?? []) as unknown as { foto_id: string; actividades: { id: string; titulo: string } | null }[])
    .filter((x) => x.actividades).map((x) => [x.foto_id, x.actividades!]));

  const n = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (f.q?.trim()) {
    const q = n(f.q.trim());
    fotos = fotos.filter((x) => n(`${x.texto_alternativo} ${x.credito ?? ''}`).includes(q));
  }
  if (f.album) fotos = fotos.filter((x) => albumDe.get(x.id)?.id === f.album);
  if (f.filtro === 'mias') fotos = fotos.filter((x) => x.creado_por === acceso.userId);

  const { data: usos } = fotos.length ? await supabase.rpc('usos_fotos', { p_ids: fotos.map((x) => x.id) }) : { data: [] };
  const usosDe = new Map<string, UsoFoto[]>();
  for (const u of (usos ?? []) as (UsoFoto & { foto_id: string })[]) {
    const { foto_id, ...resto } = u;
    usosDe.set(foto_id, [...(usosDe.get(foto_id) ?? []), resto]);
  }
  if (f.filtro === 'sin-uso') fotos = fotos.filter((x) => !usosDe.get(x.id)?.length);
  if (f.filtro === 'en-uso') fotos = fotos.filter((x) => usosDe.get(x.id)?.length);

  const urls = await firmarMiniaturas(supabase, fotos);
  const todas = gestionaTodas(acceso);
  return fotos.map((x) => ({
    ...x,
    url: urls.get(x.archivo) ?? '',
    usos: usosDe.get(x.id) ?? [],
    propia: x.creado_por === acceso.userId,
    gestionable: todas || x.creado_por === acceso.userId,
    album: albumDe.get(x.id) ?? null,
    actividad: actividadDe.get(x.id) ?? null,
  }));
}

/** Foto lista para los selectores del panel (miniatura firmada). */
export type FotoElegible = { id: string; url: string; texto_alternativo: string; ancho: number | null; alto: number | null };
