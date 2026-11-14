import 'server-only';
import type { Bloque } from '@/lib/tipos';
import type { Acceso } from './acceso';
import { firmarMiniaturas, type FotoElegible } from './fotos';
import { clientePanel } from './supabase-panel';

/** Eventos y actividades en el panel (Superadmin y Eventos; RLS lo exige). */

export const TIPOS_ACTIVIDAD: { clave: string; nombre: string }[] = [
  { clave: 'convencion', nombre: 'Convención' },
  { clave: 'encuentro', nombre: 'Encuentro' },
  { clave: 'zonal', nombre: 'Zonal' },
  { clave: 'formacion', nombre: 'Formación' },
  { clave: 'mujeres', nombre: 'Encuentro de mujeres' },
];

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
  const [{ data: fotos }, { data: enActividad }, { data: enAlbum }] = await Promise.all([
    supabase.from('fotos').select('id, archivo, anchos, texto_alternativo, ancho, alto').order('creado_en', { ascending: false }),
    supabase.from('actividad_fotos').select('foto_id, actividad_id'),
    supabase.from('album_fotos').select('foto_id, albumes(actividad_id)'),
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
export async function vistaPreviaContenidoAlDia(tipo: 'actividad' | 'album' | 'video', id: string): Promise<boolean> {
  const supabase = await clientePanel();
  const { data: huella } = await supabase.rpc('huella_contenido', { p_tipo: tipo, p_id: id });
  if (!huella) return false;
  const { count } = await supabase.from('vistas_previas_contenido').select('id', { count: 'exact', head: true })
    .eq('tipo', tipo).eq('registro_id', id).eq('huella', huella as string);
  return (count ?? 0) > 0;
}

export const puedeEventos = (a: Acceso) => a.efectivos.some((r) => r === 'superadmin' || r === 'eventos');
