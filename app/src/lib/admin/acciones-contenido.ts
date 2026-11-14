'use server';

import type { PostgrestError } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import type { EstadoFormulario } from '@/components/admin/Formulario';
import { permisoAccion } from './acceso';
import { esUuid, esYoutube, limpiarCuerpo, slugDesde } from './bloques';
import type { ClaveSeccion } from './secciones';
import { clientePanel } from './supabase-panel';

/**
 * Acciones de Eventos (actividades), Galerías (álbumes) y Videos. Escriben
 * con la sesión de la persona: RLS aplica la matriz de roles y la base exige
 * la vista previa antes de publicar y la regla 2 (un evento por foto).
 */
type Tipo = 'actividad' | 'album' | 'video';
const TABLA: Record<Tipo, string> = { actividad: 'actividades', album: 'albumes', video: 'videos' };
const SECCION: Record<Tipo, ClaveSeccion> = { actividad: 'eventos', album: 'galerias', video: 'videos' };
const RUTA: Record<Tipo, string> = { actividad: '/admin/eventos', album: '/admin/galerias', video: '/admin/videos' };
const SIN_PERMISO = 'No tienes permiso para hacer esto.';

async function exigir(tipo: Tipo) {
  if (!(await permisoAccion(SECCION[tipo]))) throw new Error(SIN_PERMISO);
  return clientePanel();
}

function mensaje(e: PostgrestError | null, porDefecto: string): string {
  if (!e) return porDefecto;
  if (e.hint === 'vista_previa_pendiente') return 'Antes de publicar, revisa la vista previa de este contenido.';
  if (e.hint === 'foto_de_otro_evento') return 'Una de las fotos ya pertenece a otro evento: no se mezclan fotos de distintos eventos.';
  if (e.hint === 'conflicto') return 'Otra persona guardó cambios antes. Recarga para ver la última versión: así no se pisan los cambios.';
  if (e.code === '23505' && /slug/.test(e.message)) return 'Ya existe otro con esa dirección. Cambia la dirección (slug).';
  if (e.code === '23505' && /una_vez/.test(e.message)) return 'Una de las fotos ya está en otro álbum o actividad.';
  if (e.code === '23514' && /anio_fecha/.test(e.message)) return 'El año no coincide con la fecha.';
  if (e.code === '23514' && /fechas/.test(e.message)) return 'La fecha de término no puede ser anterior a la de inicio.';
  if (e.code === '23514' && /abreviatura/.test(e.message)) return 'La abreviatura va en mayúsculas, de 2 a 10 letras o números (ej.: EMJ).';
  if (e.code === '23514' && /cita_con_referencia/.test(e.message)) return 'Si escribes el texto de la cita, agrega su referencia bíblica.';
  if (e.code === '23514' && /url/.test(e.message)) return 'Los enlaces deben empezar con https:// (y los videos ser de YouTube).';
  if (e.code === '23514' && /slug/.test(e.message)) return 'La dirección solo puede tener minúsculas, números y guiones.';
  if (e.code === '42501') return SIN_PERMISO;
  return porDefecto;
}

// -----------------------------------------------------------------------------
// Crear
// -----------------------------------------------------------------------------
export async function crearContenido(tipo: Tipo): Promise<void> {
  const supabase = await exigir(tipo);
  const sufijo = crypto.randomUUID().slice(0, 8);
  const fila: Record<string, unknown> | null = tipo === 'actividad'
    ? { titulo: 'Actividad sin título', slug: `borrador-${sufijo}`, tipo: 'encuentro', anio: new Date().getFullYear() }
    : tipo === 'album'
      ? { titulo: 'Álbum sin título', slug: `borrador-${sufijo}` }
      : null;
  if (!fila) return;
  const { data, error } = await supabase.from(TABLA[tipo]).insert(fila).select('id').single();
  if (error || !data) throw new Error(mensaje(error, 'No se pudo crear.'));
  redirect(`${RUTA[tipo]}/${data.id}`);
}

// -----------------------------------------------------------------------------
// Guardar actividad / álbum completos
// -----------------------------------------------------------------------------
export type ResultadoGuardar = { ok: true; version: string } | { ok: false; error: string; conflicto?: boolean };

const t = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

export type DatosActividad = {
  titulo: string; slug: string; tipo: string; anio: string; fecha_precision: 'dia' | 'mes';
  fecha_inicio: string; fecha_fin: string; lugar: string; zona: string; introduccion: string;
  lema: string; cita_texto: string; cita_referencia: string; abreviatura: string; destacar_inicio: boolean;
  portada_foto_id: string | null; fotos: string[];
  secciones: { titulo: string; contenido: unknown }[];
  enlaces: { titulo: string; url: string }[];
};

export async function guardarActividad(id: string, d: DatosActividad, version: string): Promise<ResultadoGuardar> {
  if (!esUuid(id)) return { ok: false, error: 'Actividad no válida.' };
  let supabase;
  try { supabase = await exigir('actividad'); } catch { return { ok: false, error: SIN_PERMISO }; }

  const titulo = t(d.titulo, 200);
  if (!titulo) return { ok: false, error: 'La actividad necesita un título.' };
  const anio = Number.parseInt(t(d.anio, 4), 10);
  if (!(anio >= 1970 && anio <= 2100)) return { ok: false, error: 'El año es obligatorio (ej.: 2026).' };
  // Fecha: día exacto («2026-11-20») o solo mes y año («2026-11» → día 1, precisión «mes»).
  const precision = d.fecha_precision === 'mes' ? 'mes' : 'dia';
  let inicio = t(d.fecha_inicio, 10);
  if (precision === 'mes' && /^\d{4}-\d{2}$/.test(inicio)) inicio = `${inicio}-01`;
  if (inicio && !/^\d{4}-\d{2}-\d{2}$/.test(inicio)) return { ok: false, error: 'La fecha no es válida.' };
  if (inicio && Number(inicio.slice(0, 4)) !== anio) return { ok: false, error: 'El año no coincide con la fecha.' };
  const fin = precision === 'dia' ? t(d.fecha_fin, 10) : '';
  if (fin && !inicio) return { ok: false, error: 'Para indicar la fecha de término, primero indica la de inicio.' };

  const secciones = (Array.isArray(d.secciones) ? d.secciones : []).slice(0, 30)
    .map((s) => ({ titulo: t(s?.titulo, 200), contenido: limpiarCuerpo(s?.contenido) }))
    .filter((s) => s.titulo || s.contenido.length);
  if (secciones.some((s) => !s.titulo)) return { ok: false, error: 'Cada sección necesita un título (ej.: Día 1).' };
  const enlaces = (Array.isArray(d.enlaces) ? d.enlaces : []).slice(0, 30)
    .map((e) => ({ titulo: t(e?.titulo, 200), url: t(e?.url, 500) })).filter((e) => e.titulo || e.url);
  if (enlaces.some((e) => !/^https:\/\//.test(e.url))) return { ok: false, error: 'Los enlaces deben empezar con https://' };
  if (enlaces.some((e) => !e.titulo)) return { ok: false, error: 'Cada enlace necesita un título (ej.: Transmisión Día 1).' };
  const fotos = [...new Set((d.fotos ?? []).filter(esUuid))].slice(0, 300);
  const abreviatura = t(d.abreviatura, 10).toUpperCase();

  const { data, error } = await supabase.rpc('guardar_actividad', {
    p_id: id, p_version: version,
    p_datos: {
      titulo, slug: slugDesde(t(d.slug, 120) || titulo), tipo: t(d.tipo, 40) || 'encuentro', anio,
      fecha_precision: precision, fecha_inicio: inicio, fecha_fin: fin,
      lugar: t(d.lugar, 200), zona: t(d.zona, 120), introduccion: t(d.introduccion, 5000),
      lema: t(d.lema, 80), cita_texto: t(d.cita_texto, 600), cita_referencia: t(d.cita_referencia, 60), abreviatura,
      destacar_inicio: Boolean(d.destacar_inicio), portada_foto_id: esUuid(d.portada_foto_id) ? d.portada_foto_id : '',
      fotos: fotos.map((foto_id) => ({ foto_id })), secciones, enlaces,
    },
  });
  if (error) return { ok: false, error: mensaje(error, 'No se pudo guardar.'), conflicto: error.hint === 'conflicto' };
  return { ok: true, version: data as string };
}

export type DatosAlbum = {
  titulo: string; slug: string; descripcion: string; anio: string; pais: string; ciudad: string;
  actividad_id: string | null; portada_foto_id: string | null; fotos: string[];
};

export async function guardarAlbum(id: string, d: DatosAlbum, version: string): Promise<ResultadoGuardar> {
  if (!esUuid(id)) return { ok: false, error: 'Álbum no válido.' };
  let supabase;
  try { supabase = await exigir('album'); } catch { return { ok: false, error: SIN_PERMISO }; }
  const titulo = t(d.titulo, 200);
  if (!titulo) return { ok: false, error: 'El álbum necesita un título.' };
  const anioTxt = t(d.anio, 4);
  const anio = anioTxt ? Number.parseInt(anioTxt, 10) : null;
  if (anio !== null && !(anio >= 1970 && anio <= 2100)) return { ok: false, error: 'El año no es válido.' };
  const fotos = [...new Set((d.fotos ?? []).filter(esUuid))].slice(0, 500);
  const { data, error } = await supabase.rpc('guardar_album', {
    p_id: id, p_version: version,
    p_datos: {
      titulo, slug: slugDesde(t(d.slug, 120) || titulo), descripcion: t(d.descripcion, 600), anio: anio ?? '',
      pais: t(d.pais, 80), ciudad: t(d.ciudad, 80), actividad_id: esUuid(d.actividad_id) ? d.actividad_id : '',
      portada_foto_id: esUuid(d.portada_foto_id) ? d.portada_foto_id : '', fotos: fotos.map((foto_id) => ({ foto_id })),
    },
  });
  if (error) return { ok: false, error: mensaje(error, 'No se pudo guardar.'), conflicto: error.hint === 'conflicto' };
  return { ok: true, version: data as string };
}

// -----------------------------------------------------------------------------
// Videos (formulario simple)
// -----------------------------------------------------------------------------
export async function guardarVideo(_: EstadoFormulario, f: FormData): Promise<EstadoFormulario> {
  const supabase = await exigir('video');
  const id = t(f.get('id'), 40);
  const url = t(f.get('url'), 300);
  const titulo = t(f.get('titulo'), 90);
  if (!esYoutube(url)) return { error: 'El enlace no parece de YouTube. Pega uno como https://www.youtube.com/watch?v=…' };
  if (!titulo) return { error: 'El video necesita un título.' };
  const destino = t(f.get('destino'), 60);
  const [clase, destinoId] = destino.split(':');
  const fila = {
    url, titulo, descripcion: t(f.get('descripcion'), 200) || null,
    album_id: clase === 'album' && esUuid(destinoId) ? destinoId : null,
    actividad_id: clase === 'actividad' && esUuid(destinoId) ? destinoId : null,
  };
  if (esUuid(id)) {
    const version = t(f.get('version'), 40);
    const { data, error } = await supabase.from('videos').update(fila).eq('id', id).eq('actualizado_en', version).select('id');
    if (error) return { error: mensaje(error, 'No se pudo guardar el video.') };
    if (!data?.length) return { error: 'Otra persona guardó cambios antes. Recarga para ver la última versión.' };
    redirect(`/admin/videos/${id}?aviso=guardado`);
  }
  const { data, error } = await supabase.from('videos').insert(fila).select('id').single();
  if (error || !data) return { error: mensaje(error, 'No se pudo agregar el video.') };
  redirect(`/admin/videos/${data.id}?aviso=creado`);
}

// -----------------------------------------------------------------------------
// Publicar / despublicar / eliminar
// -----------------------------------------------------------------------------
export async function publicar(tipo: Tipo, id: string): Promise<EstadoFormulario> {
  const supabase = await exigir(tipo);
  const { data, error } = await supabase.from(TABLA[tipo]).update({ estado: 'publicado' }).eq('id', id).select('id');
  if (error || !data?.length) return { error: mensaje(error, 'No se pudo publicar.') };
  redirect(`${RUTA[tipo]}/${id}?aviso=publicado`);
}

export async function despublicar(tipo: Tipo, id: string): Promise<EstadoFormulario> {
  const supabase = await exigir(tipo);
  const { data, error } = await supabase.from(TABLA[tipo]).update({ estado: 'borrador' }).eq('id', id).select('id');
  if (error || !data?.length) return { error: mensaje(error, 'No se pudo retirar del sitio.') };
  redirect(`${RUTA[tipo]}/${id}?aviso=borrador`);
}

/** Eliminar: las fotos quedan en la biblioteca (solo se quita la relación). */
export async function eliminar(tipo: Tipo, id: string): Promise<EstadoFormulario> {
  const supabase = await exigir(tipo);
  const { data, error } = await supabase.from(TABLA[tipo]).delete().eq('id', id).select('id');
  if (error || !data?.length) return { error: mensaje(error, 'No se pudo eliminar.') };
  redirect(`${RUTA[tipo]}?aviso=eliminado`);
}

// -----------------------------------------------------------------------------
// Inicio: destacar, ordenar y «Próximo evento»
// -----------------------------------------------------------------------------
export async function moverDestacada(id: string, direccion: -1 | 1): Promise<EstadoFormulario> {
  const supabase = await exigir('actividad');
  const { data } = await supabase.from('actividades').select('id, orden_inicio').eq('destacar_inicio', true).order('orden_inicio').order('titulo');
  const lista = (data ?? []) as { id: string }[];
  const i = lista.findIndex((x) => x.id === id);
  const j = i + direccion;
  if (i < 0 || j < 0 || j >= lista.length) return null;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  for (const [k, x] of lista.entries()) {
    const { error } = await supabase.from('actividades').update({ orden_inicio: k + 1 }).eq('id', x.id);
    if (error) return { error: mensaje(error, 'No se pudo ordenar.') };
  }
  redirect('/admin/eventos?aviso=ordenado');
}

export async function marcarProximo(id: string, valor: boolean): Promise<EstadoFormulario> {
  const supabase = await exigir('actividad');
  const { error } = await supabase.rpc('marcar_proximo', { p_actividad_id: id, p_valor: valor });
  if (error) return { error: mensaje(error, 'No se pudo marcar el próximo evento.') };
  redirect(`/admin/eventos?aviso=${valor ? 'proximo' : 'sin-proximo'}`);
}
