import 'server-only';
import { chileAUtc } from './hora-chile';
import { clientePanel } from './supabase-panel';

/** Registro de actividad (solo lectura; solo lo ve el Superadmin, RLS lo exige). */
export const ACCIONES: Record<string, string> = {
  crear: 'creó', editar: 'editó', publicar: 'publicó', eliminar: 'eliminó', papelera: 'envió a la papelera',
  restaurar: 'restauró', asignar_rol: 'asignó el rol', quitar_rol: 'quitó el rol',
};
export const TABLAS: Record<string, string> = {
  articulos: 'artículo', series: 'serie', temas: 'tema', actividades: 'actividad', actividad_secciones: 'sección de actividad',
  actividad_enlaces: 'enlace de actividad', fotos: 'foto', albumes: 'álbum', videos: 'video', paginas: 'página',
  secciones: 'sección de página', institucional: 'texto institucional', menu: 'enlace del menú', configuracion: 'configuración',
  redirecciones: 'redirección', perfiles: 'perfil', perfil_roles: 'rol',
};
const FEMENINO = new Set(['series', 'actividades', 'actividad_secciones', 'fotos', 'paginas', 'secciones', 'configuracion', 'redirecciones']);

export type FiltrosRegistro = { persona?: string; accion?: string; tabla?: string; desde?: string; hasta?: string; pagina?: string };
export type FilaRegistro = {
  id: string; fecha: string; accion: string; tabla: string; registro_id: string | null;
  detalle: Record<string, string | null>; perfil_id: string | null; perfiles: { nombre: string; correo: string } | null;
};
export const POR_PAGINA = 50;

export async function leerRegistro(f: FiltrosRegistro) {
  const supabase = await clientePanel();
  const pagina = Math.max(1, Number(f.pagina) || 1);
  let q = supabase.from('registro_actividad')
    .select('id, fecha, accion, tabla, registro_id, detalle, perfil_id, perfiles(nombre, correo)', { count: 'exact' })
    .order('fecha', { ascending: false })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (f.persona && /^[0-9a-f-]{36}$/.test(f.persona)) q = q.eq('perfil_id', f.persona);
  if (f.accion && f.accion in ACCIONES) q = q.eq('accion', f.accion);
  if (f.tabla && f.tabla in TABLAS) q = q.eq('tabla', f.tabla);
  const desde = f.desde && /^\d{4}-\d{2}-\d{2}$/.test(f.desde) ? chileAUtc(`${f.desde}T00:00`) : null;
  const hasta = f.hasta && /^\d{4}-\d{2}-\d{2}$/.test(f.hasta) ? chileAUtc(`${f.hasta}T23:59`) : null;
  if (desde) q = q.gte('fecha', desde.toISOString());
  if (hasta) q = q.lte('fecha', new Date(hasta.getTime() + 59_999).toISOString());
  const [{ data, count, error }, { data: personas }] = await Promise.all([
    q, supabase.from('perfiles').select('id, nombre, correo').order('nombre'),
  ]);
  if (error) throw new Error(`No se pudo leer el registro: ${error.message}`);
  return {
    filas: (data ?? []) as unknown as FilaRegistro[], total: count ?? 0, pagina,
    personas: (personas ?? []) as { id: string; nombre: string; correo: string }[],
  };
}

/** «publicó el artículo «Título»» */
export function describir(r: FilaRegistro): string {
  const que = TABLAS[r.tabla] ?? r.tabla;
  if (r.accion === 'asignar_rol' || r.accion === 'quitar_rol') return `${ACCIONES[r.accion]} «${r.detalle?.rol ?? ''}»`;
  const nombre = r.detalle?.titulo ?? r.detalle?.nombre;
  return `${ACCIONES[r.accion] ?? r.accion} ${FEMENINO.has(r.tabla) ? 'la' : 'el'} ${que}${nombre ? ` «${nombre}»` : ''}`;
}
