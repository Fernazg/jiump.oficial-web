import 'server-only';
import { fotosDeInicio } from '@/components/InicioCompleto';
import type { ClavePaginaWeb } from '@/lib/catalogo-secciones';
import { actividades, albumes, articulos, configuracion, firmarFotos, institucional, series } from '@/lib/datos';
import { fotosDeSecciones } from '@/lib/secciones';
import type { Institucional, SeccionPagina } from '@/lib/tipos';
import type { ItemInstitucional, SeccionEditable } from './acciones-sitio';
import { clientePanel } from './supabase-panel';

/** Secciones del editor → forma del sitio (con su visibilidad; el sitio dibuja solo las visibles). */
export const comoSecciones = (xs: SeccionEditable[]): SeccionPagina[] =>
  xs.map((s, i) => ({ id: `previa-${i}`, tipo: s.tipo, orden: i, visible: s.visible, contenido: s.contenido ?? {} }));

export const comoInstitucional = (xs: ItemInstitucional[]): Institucional[] =>
  xs.map((x, i) => ({ id: `previa-${i}`, tipo: x.tipo, titulo: x.titulo, texto: x.texto || null, orden: i }));

/**
 * Datos de Inicio o Nosotros para una vista previa: las secciones e
 * institucional que se indiquen (pendientes) y el resto tal como está
 * publicado. Las fotos se firman con la sesión de la persona (puede usar
 * fotos que aún no aparecen en el sitio).
 */
export async function datosPagina(clave: ClavePaginaWeb, secs: SeccionPagina[], inst?: Institucional[]) {
  const supabase = await clientePanel();
  const instFinal = inst ?? (await institucional());
  if (clave === 'inicio') {
    const [acts, arts, listaSeries, albs, conf] = await Promise.all([actividades(), articulos(), series(), albumes(), configuracion()]);
    const d = { secs, inst: instFinal, acts, arts, listaSeries, albs, conf };
    return { inicio: d, fotos: await firmarFotos(fotosDeInicio(d, fotosDeSecciones(secs)), supabase) };
  }
  return { nosotros: { secs, inst: instFinal }, fotos: await firmarFotos(fotosDeSecciones(secs), supabase) };
}

/** Registra que la persona vio esta versión (la base lo exige para publicar). */
export async function registrarVistaPrevia(tipo: 'pagina' | 'menu' | 'institucional', id: string): Promise<boolean> {
  const supabase = await clientePanel();
  const { data: huella } = await supabase.rpc('huella_contenido', { p_tipo: tipo, p_id: id });
  if (!huella) return false;
  const { error } = await supabase.from('vistas_previas_contenido').insert({ tipo, registro_id: id, huella });
  return !error;
}
