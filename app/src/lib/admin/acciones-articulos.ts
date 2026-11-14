'use server';

import type { PostgrestError } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import type { EstadoFormulario } from '@/components/admin/Formulario';
import type { Bloque } from '@/lib/tipos';
import { permisoAccion } from './acceso';
import type { ArticuloPanel } from './articulos';
import { esUuid, limpiarCuerpo, slugDesde } from './bloques';
import { chileAUtc } from './hora-chile';
import { clientePanel } from './supabase-panel';

/**
 * Acciones del servidor de Artículos. Cada una comprueba el permiso de la
 * sección (además del proxy) y escribe con la sesión de la persona, así que
 * RLS y los triggers de la base (vista previa obligatoria, versiones,
 * registro de actividad) se aplican siempre.
 */

const SIN_PERMISO = 'No tienes permiso para hacer esto. Vuelve a iniciar sesión si crees que es un error.';

function mensajeError(e: PostgrestError | null, porDefecto: string): string {
  if (!e) return porDefecto;
  if (e.hint === 'vista_previa_pendiente') return 'Antes de publicar, revisa la vista previa de este contenido.';
  if (e.code === '23505' && /parte/.test(e.message)) return 'Ya hay otro artículo con ese número de parte en la serie.';
  if (e.code === '23505' && /slug/.test(e.message)) return 'Ya existe otro artículo con esa dirección. Cambia la dirección (slug).';
  if (e.code === '23514' && /slug/.test(e.message)) return 'La dirección solo puede tener minúsculas, números y guiones.';
  if (e.code === '23514' && /parte/.test(e.message)) return 'Para indicar la parte, primero elige una serie.';
  if (e.code === '42501') return SIN_PERMISO;
  return porDefecto;
}

async function exigir() {
  const acceso = await permisoAccion('articulos');
  if (!acceso) throw new Error(SIN_PERMISO);
  return { acceso, supabase: await clientePanel() };
}

const CONTENIDO = 'titulo, bajada, autor, serie_id, parte, portada_foto_id, cuerpo';
type Contenido = Pick<ArticuloPanel, 'titulo' | 'bajada' | 'autor' | 'serie_id' | 'parte' | 'portada_foto_id'> & { cuerpo: Bloque[] };
const esPublico = (estado: string) => estado === 'publicado' || estado === 'programado';

// -----------------------------------------------------------------------------
// Crear
// -----------------------------------------------------------------------------
export async function crearArticulo(): Promise<void> {
  const { supabase } = await exigir();
  const sufijo = crypto.randomUUID().slice(0, 8);
  const { data, error } = await supabase.from('articulos')
    .insert({ titulo: 'Artículo sin título', slug: `borrador-${sufijo}` }).select('id').single();
  if (error || !data) throw new Error(mensajeError(error, 'No se pudo crear el artículo.'));
  redirect(`/admin/articulos/${data.id}`);
}

// -----------------------------------------------------------------------------
// Guardar (autoguardado del editor)
// -----------------------------------------------------------------------------
export type DatosEditor = {
  titulo: string; bajada: string; autor: string; slug: string;
  serie_id: string | null; parte: number | null; portada_foto_id: string | null;
  destacado_inicio: boolean; temas: string[]; cuerpo: unknown;
};
export type ResultadoGuardar =
  | { ok: true; version: string; guardadoEn: string; enCambios: boolean }
  | { ok: false; error: string; conflicto?: boolean };

function limpiarContenido(d: DatosEditor): Contenido | string {
  const titulo = String(d.titulo ?? '').trim().slice(0, 200);
  if (!titulo) return 'El artículo necesita un título.';
  const serie = esUuid(d.serie_id) ? d.serie_id : null;
  const parte = serie && Number.isInteger(d.parte) && (d.parte as number) > 0 && (d.parte as number) < 1000 ? d.parte : null;
  const texto = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max) || null;
  return {
    titulo,
    bajada: texto(d.bajada, 600),
    autor: texto(d.autor, 120),
    serie_id: serie,
    parte,
    portada_foto_id: esUuid(d.portada_foto_id) ? d.portada_foto_id : null,
    cuerpo: limpiarCuerpo(d.cuerpo),
  };
}

async function guardarTemas(supabase: Awaited<ReturnType<typeof clientePanel>>, id: string, temas: string[]) {
  const quiero = [...new Set((temas ?? []).filter(esUuid))].slice(0, 30);
  const { data } = await supabase.from('articulo_temas').select('tema_id').eq('articulo_id', id);
  const tengo = ((data ?? []) as { tema_id: string }[]).map((t) => t.tema_id);
  const quitar = tengo.filter((t) => !quiero.includes(t));
  const poner = quiero.filter((t) => !tengo.includes(t));
  if (quitar.length) await supabase.from('articulo_temas').delete().eq('articulo_id', id).in('tema_id', quitar);
  if (poner.length) await supabase.from('articulo_temas').insert(poner.map((tema_id) => ({ articulo_id: id, tema_id })));
}

export async function guardarArticulo(id: string, datos: DatosEditor, version: string): Promise<ResultadoGuardar> {
  if (!esUuid(id)) return { ok: false, error: 'Artículo no válido.' };
  let supabase;
  try { ({ supabase } = await exigir()); } catch { return { ok: false, error: SIN_PERMISO }; }

  const contenido = limpiarContenido(datos);
  if (typeof contenido === 'string') return { ok: false, error: contenido };

  const { data: actual } = await supabase.from('articulos')
    .select('estado, slug, actualizado_en, articulo_cambios(actualizado_en)').eq('id', id).maybeSingle();
  if (!actual) return { ok: false, error: 'El artículo ya no existe o no tienes acceso.' };
  if (actual.estado === 'papelera') return { ok: false, error: 'El artículo está en la papelera. Restáuralo para editarlo.' };
  const cambiosRel = actual.articulo_cambios as { actualizado_en: string } | { actualizado_en: string }[] | null;
  const cambiosActual = Array.isArray(cambiosRel) ? cambiosRel[0] : cambiosRel;

  let nuevaVersion: string | undefined;
  const conflicto = { ok: false as const, conflicto: true, error: 'Otra persona guardó cambios en este artículo. Recarga para ver la última versión: así no se pisan los cambios.' };

  if (esPublico(actual.estado)) {
    // Publicado o programado: los cambios se guardan aparte y el sitio sigue
    // mostrando la versión publicada hasta que se publiquen (con vista previa).
    if (cambiosActual) {
      if (cambiosActual.actualizado_en !== version && Date.parse(cambiosActual.actualizado_en) !== Date.parse(version)) return conflicto;
      const { data, error } = await supabase.from('articulo_cambios').update(contenido)
        .eq('articulo_id', id).eq('actualizado_en', cambiosActual.actualizado_en).select('actualizado_en');
      if (error) return { ok: false, error: mensajeError(error, 'No se pudo guardar.') };
      if (!data?.length) return conflicto;
      nuevaVersion = data[0].actualizado_en;
    } else {
      if (Date.parse(actual.actualizado_en) !== Date.parse(version)) return conflicto;
      const { data, error } = await supabase.from('articulo_cambios').insert({ articulo_id: id, ...contenido }).select('actualizado_en').single();
      if (error) return error.code === '23505' ? conflicto : { ok: false, error: mensajeError(error, 'No se pudo guardar.') };
      nuevaVersion = data.actualizado_en;
    }
    if (typeof datos.destacado_inicio === 'boolean') {
      await supabase.from('articulos').update({ destacado_inicio: datos.destacado_inicio }).eq('id', id);
    }
  } else {
    if (Date.parse(actual.actualizado_en) !== Date.parse(version)) return conflicto;
    const slugPedido = String(datos.slug ?? '').trim();
    const slug = slugPedido ? slugDesde(slugPedido) : actual.slug;
    const { data, error } = await supabase.from('articulos')
      .update({ ...contenido, slug, destacado_inicio: Boolean(datos.destacado_inicio) })
      .eq('id', id).eq('actualizado_en', actual.actualizado_en).select('actualizado_en');
    if (error) return { ok: false, error: mensajeError(error, 'No se pudo guardar.') };
    if (!data?.length) return conflicto;
    nuevaVersion = data[0].actualizado_en;
  }

  await guardarTemas(supabase, id, datos.temas);
  return { ok: true, version: nuevaVersion!, guardadoEn: new Date().toISOString(), enCambios: esPublico(actual.estado) };
}

// -----------------------------------------------------------------------------
// Flujo: Borrador → En revisión → Programado / Publicado
// -----------------------------------------------------------------------------
async function aplicarCambios(supabase: Awaited<ReturnType<typeof clientePanel>>, id: string): Promise<Partial<Contenido>> {
  const { data } = await supabase.from('articulo_cambios').select(CONTENIDO).eq('articulo_id', id).maybeSingle();
  return (data as Contenido | null) ?? {};
}

export async function enviarARevision(id: string): Promise<EstadoFormulario> {
  const { supabase } = await exigir();
  const { error, data } = await supabase.from('articulos').update({ estado: 'revision' }).eq('id', id).eq('estado', 'borrador').select('id');
  if (error || !data?.length) return { error: mensajeError(error, 'Solo un borrador se puede enviar a revisión.') };
  redirect(`/admin/articulos/${id}?aviso=revision`);
}

export async function volverABorrador(id: string): Promise<EstadoFormulario> {
  const { supabase } = await exigir();
  // Si estaba publicado o programado, sale del sitio y conserva los cambios pendientes.
  const cambios = await aplicarCambios(supabase, id);
  const { error, data } = await supabase.from('articulos')
    .update({ ...cambios, estado: 'borrador', publicar_en: null }).eq('id', id).neq('estado', 'papelera').select('id');
  if (error || !data?.length) return { error: mensajeError(error, 'No se pudo pasar a borrador.') };
  await supabase.from('articulo_cambios').delete().eq('articulo_id', id);
  redirect(`/admin/articulos/${id}?aviso=borrador`);
}

export async function publicarArticulo(_: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const id = String(datos.get('id') ?? '');
  const modo = datos.get('modo') === 'programar' ? 'programar' : 'ahora';
  if (!esUuid(id)) return { error: 'Artículo no válido.' };
  const { supabase } = await exigir();

  const { data: actual } = await supabase.from('articulos').select('estado, publicado_en').eq('id', id).maybeSingle();
  if (!actual || actual.estado === 'papelera') return { error: 'El artículo no existe o está en la papelera.' };

  let cambiosEstado: Record<string, unknown>;
  let aviso: string;
  if (modo === 'programar') {
    const local = String(datos.get('fecha') ?? '');
    const fecha = chileAUtc(local);
    if (!fecha) return { error: 'Elige una fecha y hora válidas (horario de Chile).' };
    if (fecha.getTime() < Date.now() + 60_000) return { error: 'La fecha programada debe ser en el futuro.' };
    cambiosEstado = { estado: 'programado', publicar_en: fecha.toISOString(), publicado_en: fecha.toISOString() };
    aviso = 'programado';
  } else {
    const yaPublicado = actual.estado === 'publicado' && actual.publicado_en;
    cambiosEstado = { estado: 'publicado', publicar_en: null, publicado_en: yaPublicado ? actual.publicado_en : new Date().toISOString() };
    aviso = 'publicado';
  }

  const contenido = await aplicarCambios(supabase, id);
  const { error, data } = await supabase.from('articulos').update({ ...contenido, ...cambiosEstado }).eq('id', id).select('id');
  if (error || !data?.length) return { error: mensajeError(error, 'No se pudo publicar.') };
  await supabase.from('articulo_cambios').delete().eq('articulo_id', id);
  redirect(`/admin/articulos/${id}?aviso=${aviso}`);
}

export async function descartarCambios(id: string): Promise<EstadoFormulario> {
  const { supabase } = await exigir();
  const { error } = await supabase.from('articulo_cambios').delete().eq('articulo_id', id);
  if (error) return { error: mensajeError(error, 'No se pudieron descartar los cambios.') };
  redirect(`/admin/articulos/${id}?aviso=descartados`);
}

// -----------------------------------------------------------------------------
// Papelera (30 días) y borrado definitivo
// -----------------------------------------------------------------------------
export async function moverAPapelera(id: string, volverA = '/admin/articulos'): Promise<EstadoFormulario> {
  const { supabase } = await exigir();
  const cambios = await aplicarCambios(supabase, id);
  const { error, data } = await supabase.from('articulos').update({ ...cambios, estado: 'papelera' }).eq('id', id).neq('estado', 'papelera').select('titulo');
  if (error || !data?.length) return { error: mensajeError(error, 'No se pudo mover a la papelera.') };
  await supabase.from('articulo_cambios').delete().eq('articulo_id', id);
  redirect(`${volverA.startsWith('/admin/articulos') ? volverA : '/admin/articulos'}${volverA.includes('?') ? '&' : '?'}aviso=papelera`);
}

export async function restaurarDePapelera(id: string): Promise<EstadoFormulario> {
  const { supabase } = await exigir();
  const { error } = await supabase.rpc('restaurar_articulo', { p_articulo_id: id });
  if (error) {
    return { error: /parte/.test(error.message) ? 'No se puede restaurar: ya hay otro artículo con ese número de parte en la serie. Cambia la parte del otro primero.' : 'No se pudo restaurar.' };
  }
  redirect(`/admin/articulos/${id}?aviso=restaurado`);
}

export async function eliminarDefinitivo(id: string): Promise<EstadoFormulario> {
  const { supabase } = await exigir();
  const { error, data } = await supabase.from('articulos').delete().eq('id', id).eq('estado', 'papelera').select('id');
  if (error || !data?.length) return { error: mensajeError(error, 'Solo se puede eliminar definitivamente desde la papelera.') };
  redirect('/admin/articulos?estado=papelera&aviso=eliminado');
}

// -----------------------------------------------------------------------------
// Historial de versiones
// -----------------------------------------------------------------------------
export async function restaurarVersion(articuloId: string, versionId: string): Promise<EstadoFormulario> {
  const { supabase } = await exigir();
  const { data: v } = await supabase.from('articulo_versiones').select(CONTENIDO).eq('id', versionId).eq('articulo_id', articuloId).maybeSingle();
  if (!v) return { error: 'No se encontró esa versión.' };
  const { data: a } = await supabase.from('articulos').select('estado').eq('id', articuloId).maybeSingle();
  if (!a || a.estado === 'papelera') return { error: 'Restaura el artículo de la papelera antes de recuperar una versión.' };

  // En un artículo publicado, la versión vuelve como cambio pendiente (con vista previa antes de publicarse).
  const { error } = esPublico(a.estado)
    ? await supabase.from('articulo_cambios').upsert({ articulo_id: articuloId, ...(v as Contenido) })
    : await supabase.from('articulos').update(v as Contenido).eq('id', articuloId);
  if (error) return { error: mensajeError(error, 'No se pudo restaurar la versión.') };
  redirect(`/admin/articulos/${articuloId}?aviso=version`);
}

// -----------------------------------------------------------------------------
// Edición simultánea: presencia en el editor
// -----------------------------------------------------------------------------
export type Latido = { otros: string[]; version: string | null; estado: string | null };

export async function latido(id: string): Promise<Latido> {
  if (!esUuid(id)) return { otros: [], version: null, estado: null };
  const acceso = await permisoAccion('articulos');
  if (!acceso) return { otros: [], version: null, estado: null };
  const supabase = await clientePanel();
  await supabase.from('articulo_presencia')
    .upsert({ articulo_id: id, user_id: acceso.userId, nombre: acceso.nombre, visto_en: new Date().toISOString() });
  const hace = new Date(Date.now() - 45_000).toISOString();
  const [{ data: presentes }, { data: art }] = await Promise.all([
    supabase.from('articulo_presencia').select('nombre, user_id').eq('articulo_id', id).neq('user_id', acceso.userId).gte('visto_en', hace),
    supabase.from('articulos').select('estado, actualizado_en, articulo_cambios(actualizado_en)').eq('id', id).maybeSingle(),
  ]);
  const rel = art?.articulo_cambios as { actualizado_en: string } | { actualizado_en: string }[] | null | undefined;
  const cambios = Array.isArray(rel) ? rel[0] : rel;
  return {
    otros: [...new Set(((presentes ?? []) as { nombre: string }[]).map((p) => p.nombre || 'Otra persona del equipo'))],
    version: art ? (esPublico(art.estado) && cambios ? cambios.actualizado_en : art.actualizado_en) : null,
    estado: art?.estado ?? null,
  };
}

export async function salirDelEditor(id: string): Promise<void> {
  const acceso = await permisoAccion('articulos');
  if (!acceso || !esUuid(id)) return;
  const supabase = await clientePanel();
  await supabase.from('articulo_presencia').delete().eq('articulo_id', id).eq('user_id', acceso.userId);
}
