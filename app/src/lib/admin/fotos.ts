import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { leerTodo } from '../leer-todo';
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

export type FiltrosFotos = { q?: string; filtro?: string; album?: string; pagina?: string; foto?: string };

/** Fotos por página en la biblioteca: se firman y se dibujan solo las de la página. */
export const FOTOS_POR_PAGINA = 60;

export type PaginaFotos = { fotos: FotoPanel[]; total: number; pagina: number; paginas: number };

export async function listarFotos(acceso: Acceso, f: FiltrosFotos = {}): Promise<PaginaFotos> {
  const supabase = await clientePanel();
  type Fila = Omit<FotoPanel, 'url' | 'usos' | 'propia' | 'gestionable' | 'album' | 'actividad'>;
  const [todas, enAlbum, enActividad] = await Promise.all([
    leerTodo<Fila>((d, h) => supabase.from('fotos').select('id, archivo, ancho, alto, texto_alternativo, credito, anchos, creado_por, creado_en')
      .order('creado_en', { ascending: false }).order('id').range(d, h), 'la biblioteca'),
    leerTodo<{ foto_id: string; albumes: { id: string; titulo: string } | null }>((d, h) => supabase.from('album_fotos').select('foto_id, albumes(id, titulo)').order('album_id').order('foto_id').range(d, h), 'los álbumes de las fotos'),
    leerTodo<{ foto_id: string; actividades: { id: string; titulo: string } | null }>((d, h) => supabase.from('actividad_fotos').select('foto_id, actividades(id, titulo)').order('actividad_id').order('foto_id').range(d, h), 'las actividades de las fotos'),
  ]);
  let fotos = todas;

  const albumDe = new Map(enAlbum.filter((x) => x.albumes).map((x) => [x.foto_id, x.albumes!]));
  const actividadDe = new Map(enActividad.filter((x) => x.actividades).map((x) => [x.foto_id, x.actividades!]));

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

  // Solo se firman y se devuelven las fotos de la página pedida (o la página donde está la foto elegida).
  const total = fotos.length;
  const paginas = Math.max(1, Math.ceil(total / FOTOS_POR_PAGINA));
  const indiceElegida = f.foto ? fotos.findIndex((x) => x.id === f.foto) : -1;
  const pedida = indiceElegida >= 0 && !f.pagina ? Math.floor(indiceElegida / FOTOS_POR_PAGINA) + 1 : Math.floor(Number(f.pagina)) || 1;
  const pagina = Math.min(paginas, Math.max(1, pedida));
  fotos = fotos.slice((pagina - 1) * FOTOS_POR_PAGINA, pagina * FOTOS_POR_PAGINA);

  const urls = await firmarMiniaturas(supabase, fotos);
  const gestionaTodo = gestionaTodas(acceso);
  return {
    total, pagina, paginas,
    fotos: fotos.map((x) => ({
      ...x,
      url: urls.get(x.archivo) ?? '',
      usos: usosDe.get(x.id) ?? [],
      propia: x.creado_por === acceso.userId,
      gestionable: gestionaTodo || x.creado_por === acceso.userId,
      album: albumDe.get(x.id) ?? null,
      actividad: actividadDe.get(x.id) ?? null,
    })),
  };
}

/** Foto lista para los selectores del panel (miniatura firmada). */
export type FotoElegible = { id: string; url: string; texto_alternativo: string; ancho: number | null; alto: number | null };
