import 'server-only';
import type { Bloque, Serie, Tema } from '@/lib/tipos';
import { clientePanel } from './supabase-panel';

/**
 * Consultas de artículos del panel. Usan la sesión de la persona: RLS deja
 * ver todo (borradores incluidos) solo a Superadmin y Editor.
 */

export type EstadoArticulo = 'borrador' | 'revision' | 'programado' | 'publicado' | 'papelera';

export type ArticuloPanel = {
  id: string;
  titulo: string;
  slug: string;
  bajada: string | null;
  autor: string | null;
  serie_id: string | null;
  parte: number | null;
  portada_foto_id: string | null;
  cuerpo: Bloque[];
  estado: EstadoArticulo;
  publicar_en: string | null;
  publicado_en: string | null;
  destacado_inicio: boolean;
  minutos_lectura: number;
  en_papelera_desde: string | null;
  creado_en: string;
  actualizado_en: string;
};

export type CambiosPendientes = Pick<ArticuloPanel, 'titulo' | 'bajada' | 'autor' | 'serie_id' | 'parte' | 'portada_foto_id' | 'cuerpo' | 'actualizado_en'>;

export const COLUMNAS =
  'id, titulo, slug, bajada, autor, serie_id, parte, portada_foto_id, cuerpo, estado, publicar_en, publicado_en, destacado_inicio, minutos_lectura, en_papelera_desde, creado_en, actualizado_en';
const COLUMNAS_LISTA =
  'id, titulo, slug, bajada, autor, serie_id, parte, portada_foto_id, estado, publicar_en, publicado_en, destacado_inicio, en_papelera_desde, creado_en, actualizado_en';

/** Estado que ve el visitante: un programado cuya fecha ya llegó está publicado. */
export type EstadoVisible = EstadoArticulo;
export function estadoVisible(a: Pick<ArticuloPanel, 'estado' | 'publicar_en'>, ahora = Date.now()): EstadoVisible {
  if (a.estado === 'programado' && a.publicar_en && new Date(a.publicar_en).getTime() <= ahora) return 'publicado';
  return a.estado;
}

export const ESTADOS: { clave: EstadoArticulo; nombre: string; chip: string }[] = [
  { clave: 'publicado', nombre: 'Publicado', chip: 'bg-[#e0f5f3] text-[#00665f]' },
  { clave: 'borrador', nombre: 'Borrador', chip: 'bg-[#eef0f2] text-texto-2' },
  { clave: 'revision', nombre: 'En revisión', chip: 'bg-[#fff1d6] text-[#7a4b00]' },
  { clave: 'programado', nombre: 'Programado', chip: 'bg-azul-claro text-azul-oscuro' },
  { clave: 'papelera', nombre: 'Papelera', chip: 'bg-rojo-claro text-rojo-oscuro' },
];
export const estadoInfo = (e: EstadoArticulo) => ESTADOS.find((x) => x.clave === e)!;

/** Días que le quedan en la papelera (se vacía sola a los 30). */
export function diasEnPapelera(desde: string | null, ahora = Date.now()): number {
  if (!desde) return 30;
  return Math.max(0, 30 - Math.floor((ahora - new Date(desde).getTime()) / 86_400_000));
}

function sinTildes(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export type FiltrosArticulos = { estado?: string; serie?: string; tema?: string; q?: string };
export type FilaArticulo = Omit<ArticuloPanel, 'cuerpo' | 'minutos_lectura'> & { temas: string[]; cambios: boolean };

export async function listarArticulos(f: FiltrosArticulos): Promise<FilaArticulo[]> {
  const supabase = await clientePanel();
  let consulta = supabase.from('articulos').select(`${COLUMNAS_LISTA}, articulo_temas(tema_id), articulo_cambios(articulo_id)`)
    .order('actualizado_en', { ascending: false });
  if (f.serie === 'sin-serie') consulta = consulta.is('serie_id', null);
  else if (f.serie) consulta = consulta.eq('serie_id', f.serie);
  const { data, error } = await consulta;
  if (error) throw new Error(`No se pudieron leer los artículos: ${error.message}`);

  type Fila = Omit<FilaArticulo, 'temas' | 'cambios'> & { articulo_temas: { tema_id: string }[]; articulo_cambios: unknown };
  let filas: FilaArticulo[] = ((data ?? []) as unknown as Fila[]).map(({ articulo_temas, articulo_cambios, ...a }) => ({
    ...a,
    temas: articulo_temas.map((t) => t.tema_id),
    cambios: Array.isArray(articulo_cambios) ? articulo_cambios.length > 0 : Boolean(articulo_cambios),
  }));

  // Estado: la papelera solo aparece si se pide; «publicado» incluye programados cuya fecha llegó.
  const estado = f.estado as EstadoArticulo | undefined;
  filas = filas.filter((a) => (estado === 'papelera' ? a.estado === 'papelera' : a.estado !== 'papelera'));
  if (estado && estado !== 'papelera') filas = filas.filter((a) => estadoVisible(a) === estado);
  if (f.tema) filas = filas.filter((a) => a.temas.includes(f.tema!));

  const q = f.q?.trim();
  if (q) {
    // Título, bajada y autor (sin tildes) + búsqueda de texto completo en el cuerpo.
    const nq = sinTildes(q);
    const { data: porTexto } = await supabase.rpc('buscar_articulos', { q }).select('id');
    const ids = new Set(((porTexto ?? []) as { id: string }[]).map((x) => x.id));
    filas = filas.filter((a) => ids.has(a.id) || [a.titulo, a.bajada, a.autor].some((t) => t && sinTildes(t).includes(nq)));
  }
  return filas;
}

export async function seriesYTemas(): Promise<{ series: (Serie & { total: number })[]; temas: (Tema & { total: number })[] }> {
  const supabase = await clientePanel();
  const [s, t] = await Promise.all([
    supabase.from('series').select('id, nombre, slug, descripcion, tipo, mes, color, icono, orden, articulos(count)').order('orden').order('nombre'),
    supabase.from('temas').select('id, nombre, slug, articulo_temas(count)').order('nombre'),
  ]);
  if (s.error) throw new Error(`No se pudieron leer las series: ${s.error.message}`);
  if (t.error) throw new Error(`No se pudieron leer los temas: ${t.error.message}`);
  type ConCuenta<T> = T & { articulos?: { count: number }[]; articulo_temas?: { count: number }[] };
  return {
    series: ((s.data ?? []) as ConCuenta<Serie>[]).map(({ articulos, ...x }) => ({ ...x, total: articulos?.[0]?.count ?? 0 })),
    temas: ((t.data ?? []) as ConCuenta<Tema>[]).map(({ articulo_temas, ...x }) => ({ ...x, total: articulo_temas?.[0]?.count ?? 0 })),
  };
}

export const nombreSerie = (s: Pick<Serie, 'nombre' | 'tipo' | 'mes'>) => {
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return s.tipo === 'mes' && s.mes ? `${meses[s.mes - 1]} · ${s.nombre}` : s.nombre;
};

export async function articuloParaEditar(id: string) {
  const supabase = await clientePanel();
  const [a, c, t] = await Promise.all([
    supabase.from('articulos').select(COLUMNAS).eq('id', id).maybeSingle(),
    supabase.from('articulo_cambios').select('titulo, bajada, autor, serie_id, parte, portada_foto_id, cuerpo, actualizado_en').eq('articulo_id', id).maybeSingle(),
    supabase.from('articulo_temas').select('tema_id').eq('articulo_id', id),
  ]);
  if (a.error) throw new Error(`No se pudo leer el artículo: ${a.error.message}`);
  if (!a.data) return null;
  return {
    articulo: a.data as ArticuloPanel,
    cambios: (c.data as CambiosPendientes | null) ?? null,
    temas: ((t.data ?? []) as { tema_id: string }[]).map((x) => x.tema_id),
  };
}

export type Version = { id: string; titulo: string; guardado_en: string; quien: string; estado: EstadoArticulo };

/**
 * Historial de versiones. El nombre de quien guardó solo se ve si el perfil
 * es legible para la persona (el propio, o todos para Superadmin).
 */
export async function versiones(articuloId: string, yo: string): Promise<Version[]> {
  const supabase = await clientePanel();
  const { data } = await supabase.from('articulo_versiones')
    .select('id, titulo, guardado_en, guardado_por, estado').eq('articulo_id', articuloId)
    .order('guardado_en', { ascending: false }).limit(30);
  const filas = (data ?? []) as { id: string; titulo: string; guardado_en: string; guardado_por: string | null; estado: EstadoArticulo }[];
  const ids = [...new Set(filas.map((v) => v.guardado_por).filter((x): x is string => Boolean(x)))];
  const nombres = new Map<string, string>();
  if (ids.length) {
    const { data: perfiles } = await supabase.from('perfiles').select('user_id, nombre, correo').in('user_id', ids);
    for (const p of (perfiles ?? []) as { user_id: string; nombre: string; correo: string }[]) nombres.set(p.user_id, p.nombre || p.correo);
  }
  return filas.map((v) => ({
    id: v.id, titulo: v.titulo, guardado_en: v.guardado_en, estado: v.estado,
    quien: v.guardado_por === yo ? 'Tú' : (v.guardado_por && nombres.get(v.guardado_por)) || 'Otra persona del equipo',
  }));
}

/** ¿Esta persona ya vio la vista previa del contenido vigente? */
export async function vistaPreviaAlDia(articuloId: string): Promise<boolean> {
  const supabase = await clientePanel();
  const { data: huella } = await supabase.rpc('huella_vigente_articulo', { p_articulo_id: articuloId });
  if (!huella) return false;
  const { count } = await supabase.from('articulo_vistas_previas')
    .select('id', { count: 'exact', head: true }).eq('articulo_id', articuloId).eq('huella', huella as string);
  return (count ?? 0) > 0;
}

/** Fotos de la biblioteca (todo el equipo las ve) con URL firmada, para elegir portada o imagen. */
export async function bibliotecaFotos(): Promise<{ id: string; url: string; texto_alternativo: string; ancho: number | null; alto: number | null }[]> {
  const supabase = await clientePanel();
  const { data, error } = await supabase.from('fotos').select('id, archivo, texto_alternativo, ancho, alto').order('creado_en', { ascending: false });
  if (error) throw new Error(`No se pudo leer la biblioteca de fotos: ${error.message}`);
  const fotos = (data ?? []) as { id: string; archivo: string; texto_alternativo: string; ancho: number | null; alto: number | null }[];
  if (!fotos.length) return [];
  const { data: firmas } = await supabase.storage.from('fotos').createSignedUrls(fotos.map((f) => f.archivo), 60 * 60);
  const porRuta = new Map((firmas ?? []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
  return fotos.flatMap(({ archivo, ...f }) => (porRuta.get(archivo) ? [{ ...f, url: porRuta.get(archivo)! }] : []));
}
