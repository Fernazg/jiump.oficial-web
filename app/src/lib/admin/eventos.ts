import 'server-only';
import type { Bloque } from '@/lib/tipos';
import type { Acceso } from './acceso';
import { firmarMiniaturas, type FotoElegible } from './fotos';
import { clientePanel } from './supabase-panel';
import { leerTodo } from '../leer-todo';

/** Eventos y actividades en el panel (Superadmin y Eventos; RLS lo exige). */

export const TIPOS_ACTIVIDAD: { clave: string; nombre: string }[] = [
  { clave: 'convencion', nombre: 'Convención' },
  { clave: 'encuentro', nombre: 'Encuentro' },
  { clave: 'zonal', nombre: 'Zonal' },
  { clave: 'formacion', nombre: 'Formación' },
  { clave: 'mujeres', nombre: 'Encuentro de mujeres' },
];

export type TipoContenido = 'actividad' | 'album' | 'video' | 'pagina' | 'menu' | 'institucional';
export type EstadoContenido = 'borrador' | 'publicado' | 'archivado';

export type ActividadPanel = {
  id: string; titulo: string; slug: string; tipo: string; anio: number;
  fecha_inicio: string | null; fecha_precision: 'dia' | 'mes'; fecha_fin: string | null;
  lugar: string | null; zona: string | null; introduccion: string | null;
  lema: string | null; cita_texto: string | null; cita_referencia: string | null; abreviatura: string | null;
  portada_foto_id: string | null; estado: EstadoContenido;
  destacar_inicio: boolean; orden_inicio: number; es_proximo: boolean;
  actualizado_en: string;
};

const COLUMNAS = 'id, titulo, slug, tipo, anio, fecha_inicio, fecha_precision, fecha_fin, lugar, zona, introduccion, lema, cita_texto, cita_referencia, abreviatura, portada_foto_id, estado, destacar_inicio, orden_inicio, es_proximo, actualizado_en';

export type FilaActividad = ActividadPanel & { fotos: number };

export async function listarActividades(): Promise<FilaActividad[]> {
  const supabase = await clientePanel();
  const { data, error } = await supabase.from('actividades').select(`${COLUMNAS}, actividad_fotos(count)`)
    .order('anio', { ascending: false }).order('fecha_inicio', { ascending: false, nullsFirst: false }).order('titulo');
  if (error) throw new Error(`No se pudieron leer las actividades: ${error.message}`);
  return ((data ?? []) as (ActividadPanel & { actividad_fotos: { count: number }[] })[])
    .map(({ actividad_fotos, ...a }) => ({ ...a, fotos: actividad_fotos?.[0]?.count ?? 0 }));
}

export type SeccionEditable = { titulo: string; contenido: Bloque[] };
export type EnlaceEditable = { titulo: string; url: string };

export async function actividadParaEditar(id: string) {
  const supabase = await clientePanel();
  const [a, s, e, f] = await Promise.all([
    supabase.from('actividades').select(COLUMNAS).eq('id', id).maybeSingle(),
    supabase.from('actividad_secciones').select('titulo, contenido').eq('actividad_id', id).order('orden'),
    supabase.from('actividad_enlaces').select('titulo, url').eq('actividad_id', id).order('orden'),
    supabase.from('actividad_fotos').select('foto_id').eq('actividad_id', id).order('orden'),
  ]);
  if (!a.data) return null;
  return {
    actividad: a.data as ActividadPanel,
    secciones: (s.data ?? []) as SeccionEditable[],
    enlaces: (e.data ?? []) as EnlaceEditable[],
    fotos: ((f.data ?? []) as { foto_id: string }[]).map((x) => x.foto_id),
  };
}

/**
 * Fotos que se pueden agregar a esta actividad (regla 2: una foto, un solo
 * evento): las que no están en otra actividad ni en un álbum de otro evento.
 */
export async function fotosParaActividad(actividadId: string): Promise<FotoElegible[]> {
  const supabase = await clientePanel();
  // Por tramos: una consulta sola se corta en 1.000 filas sin avisar.
  const [fotos, enActividad, enAlbum] = await Promise.all([
    leerTodo((d, h) => supabase.from('fotos').select('id, archivo, anchos, texto_alternativo, ancho, alto').order('creado_en', { ascending: false }).order('id').range(d, h), 'las fotos'),
    leerTodo((d, h) => supabase.from('actividad_fotos').select('foto_id, actividad_id').order('actividad_id').order('foto_id').range(d, h), 'las fotos de actividades'),
    leerTodo((d, h) => supabase.from('album_fotos').select('foto_id, albumes(actividad_id)').order('album_id').order('foto_id').range(d, h), 'las fotos de álbumes'),
  ]);
  const ocupada = new Set<string>();
  for (const x of (enActividad ?? []) as { foto_id: string; actividad_id: string }[]) if (x.actividad_id !== actividadId) ocupada.add(x.foto_id);
  for (const x of (enAlbum ?? []) as unknown as { foto_id: string; albumes: { actividad_id: string | null } | null }[]) {
    if (x.albumes?.actividad_id !== actividadId) ocupada.add(x.foto_id);
  }
  const libres = ((fotos ?? []) as { id: string; archivo: string; anchos: number[]; texto_alternativo: string; ancho: number | null; alto: number | null }[])
    .filter((x) => !ocupada.has(x.id));
  const urls = await firmarMiniaturas(supabase, libres);
  return libres.map((x) => ({ id: x.id, url: urls.get(x.archivo) ?? '', texto_alternativo: x.texto_alternativo, ancho: x.ancho, alto: x.alto }));
}

/** Miniaturas de fotos ya elegidas (aunque no estén en la lista de libres). */
export async function miniaturas(ids: string[]): Promise<FotoElegible[]> {
  if (!ids.length) return [];
  const supabase = await clientePanel();
  const { data } = await supabase.from('fotos').select('id, archivo, anchos, texto_alternativo, ancho, alto').in('id', ids);
  const fotos = (data ?? []) as { id: string; archivo: string; anchos: number[]; texto_alternativo: string; ancho: number | null; alto: number | null }[];
  const urls = await firmarMiniaturas(supabase, fotos);
  const porId = new Map(fotos.map((x) => [x.id, { id: x.id, url: urls.get(x.archivo) ?? '', texto_alternativo: x.texto_alternativo, ancho: x.ancho, alto: x.alto }]));
  return ids.flatMap((id) => (porId.get(id) ? [porId.get(id)!] : []));
}

/** ¿Esta persona vio la vista previa del contenido guardado? */
export async function vistaPreviaContenidoAlDia(tipo: TipoContenido, id: string): Promise<boolean> {
  const supabase = await clientePanel();
  const { data: huella } = await supabase.rpc('huella_contenido', { p_tipo: tipo, p_id: id });
  if (!huella) return false;
  const { count } = await supabase.from('vistas_previas_contenido').select('id', { count: 'exact', head: true })
    .eq('tipo', tipo).eq('registro_id', id).eq('huella', huella as string);
  return (count ?? 0) > 0;
}

export const puedeEventos = (a: Acceso) => a.efectivos.some((r) => r === 'superadmin' || r === 'eventos');

/** Cambios pendientes de algo ya publicado (null si no hay). */
export type Cambios = { datos: Record<string, unknown>; actualizado_en: string };
export async function cambiosPendientes(tipo: TipoContenido, id: string): Promise<Cambios | null> {
  const supabase = await clientePanel();
  const { data } = await supabase.from('contenido_cambios').select('datos, actualizado_en').eq('tipo', tipo).eq('registro_id', id).maybeSingle();
  return (data as Cambios | null) ?? null;
}

const vacioANull = (v: unknown) => (v === '' || v === undefined ? null : v);

/** Actividad + secciones/enlaces/fotos a partir de los cambios pendientes (forma de guardar_contenido). */
export function actividadDesdeCambios(base: ActividadPanel, datos: Record<string, unknown>) {
  const d = datos as {
    titulo: string; slug: string; tipo: string; anio: number | string; fecha_inicio?: string; fecha_precision?: 'dia' | 'mes'; fecha_fin?: string;
    lugar?: string; zona?: string; introduccion?: string; lema?: string; cita_texto?: string; cita_referencia?: string; abreviatura?: string;
    portada_foto_id?: string; fotos?: { foto_id: string }[]; secciones?: SeccionEditable[]; enlaces?: EnlaceEditable[];
  };
  const actividad: ActividadPanel = {
    ...base,
    titulo: d.titulo, slug: d.slug, tipo: d.tipo, anio: Number(d.anio),
    fecha_inicio: vacioANull(d.fecha_inicio) as string | null, fecha_precision: d.fecha_precision ?? 'dia', fecha_fin: vacioANull(d.fecha_fin) as string | null,
    lugar: vacioANull(d.lugar) as string | null, zona: vacioANull(d.zona) as string | null, introduccion: vacioANull(d.introduccion) as string | null,
    lema: vacioANull(d.lema) as string | null, cita_texto: vacioANull(d.cita_texto) as string | null,
    cita_referencia: vacioANull(d.cita_referencia) as string | null, abreviatura: vacioANull(d.abreviatura) as string | null,
    portada_foto_id: vacioANull(d.portada_foto_id) as string | null,
  };
  return {
    actividad,
    secciones: d.secciones ?? [],
    enlaces: d.enlaces ?? [],
    fotos: (d.fotos ?? []).map((f) => f.foto_id),
  };
}
