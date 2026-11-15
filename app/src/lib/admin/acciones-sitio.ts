'use server';

import { CATALOGO, type ClavePaginaWeb } from '@/lib/catalogo-secciones';
import { permisoAccion } from './acceso';
import type { ResultadoGuardar } from './acciones-contenido';
import { esUuid } from './bloques';
import type { ClaveSeccion } from './secciones';
import { clientePanel } from './supabase-panel';

/**
 * Página web, menú y textos institucionales (solo Superadmin). Todo se guarda
 * con guardar_contenido(): si ya está a la vista del público, queda como
 * cambio pendiente hasta revisar la vista previa y publicarlo.
 */
const ID_CONJUNTO = '00000000-0000-0000-0000-000000000000';
const t = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '');
const urlValida = (u: string) => /^(\/[^\s]*|https:\/\/[^\s]+)$/.test(u);

async function guardar(seccion: ClaveSeccion, tipo: string, id: string, version: string, datos: unknown): Promise<ResultadoGuardar> {
  if (!(await permisoAccion(seccion))) return { ok: false, error: 'No tienes permiso para hacer esto.' };
  const supabase = await clientePanel();
  const { data, error } = await supabase.rpc('guardar_contenido', { p_tipo: tipo, p_id: id, p_version: version, p_datos: datos });
  if (error) {
    if (error.hint === 'conflicto') return { ok: false, conflicto: true, error: 'Otra persona guardó cambios antes. Recarga para ver la última versión.' };
    if (error.code === '23514' && /url/.test(error.message)) return { ok: false, error: 'Los enlaces deben empezar con / (página del sitio) o https://' };
    return { ok: false, error: 'No se pudo guardar.' };
  }
  return { ok: true, version: data as string };
}

// -----------------------------------------------------------------------------
// Página: SEO y secciones (orden, visibilidad y contenido según el catálogo)
// -----------------------------------------------------------------------------
export type SeccionEditable = { tipo: string; visible: boolean; contenido: Record<string, unknown> };
export type DatosPagina = { seo_titulo: string; seo_descripcion: string; secciones: SeccionEditable[] };

function limpiarContenido(pagina: ClavePaginaWeb, tipo: string, c: Record<string, unknown>): Record<string, unknown> | string {
  const def = CATALOGO[pagina].find((x) => x.tipo === tipo);
  if (!def) return {};
  const salida: Record<string, unknown> = {};
  for (const campo of def.campos) {
    const v = c?.[campo.clave];
    if (campo.tipo === 'texto') {
      const x = t(v, campo.max);
      if (x) salida[campo.clave] = x;
    } else if (campo.tipo === 'foto') {
      if (esUuid(v)) salida[campo.clave] = v;
    } else if (campo.tipo === 'fotos') {
      const xs = (Array.isArray(v) ? v : []).filter(esUuid).slice(0, campo.max);
      if (xs.length) salida[campo.clave] = xs;
    } else if (campo.tipo === 'boton') {
      const o = (v ?? {}) as Record<string, unknown>;
      const texto = t(o.texto, 40), url = t(o.url, 300);
      if (texto || url) {
        if (!texto || !urlValida(url)) return `«${def.nombre}»: el botón necesita un texto y un destino que empiece con / o https://`;
        salida[campo.clave] = { texto, url };
      }
    } else if (campo.tipo === 'tarjetas') {
      const xs = (Array.isArray(v) ? v : []).slice(0, campo.max)
        .map((k) => ({ titulo: t((k as Record<string, unknown>)?.titulo, 60), foto_id: esUuid((k as Record<string, unknown>)?.foto_id) ? (k as Record<string, string>).foto_id : undefined }))
        .filter((k) => k.titulo || k.foto_id);
      if (xs.length) salida[campo.clave] = xs;
    }
  }
  return salida;
}

export async function guardarPagina(id: string, clave: ClavePaginaWeb, d: DatosPagina, version: string): Promise<ResultadoGuardar> {
  if (!esUuid(id) || !(clave in CATALOGO)) return { ok: false, error: 'Página no válida.' };
  const catalogo = CATALOGO[clave];
  const vistos = new Set<string>();
  const secciones: SeccionEditable[] = [];
  for (const s of Array.isArray(d.secciones) ? d.secciones : []) {
    if (!catalogo.some((x) => x.tipo === s?.tipo) || vistos.has(s.tipo)) continue;
    vistos.add(s.tipo);
    const contenido = limpiarContenido(clave, s.tipo, s.contenido ?? {});
    if (typeof contenido === 'string') return { ok: false, error: contenido };
    secciones.push({ tipo: s.tipo, visible: s.visible !== false, contenido });
  }
  // Las que falten quedan al final, ocultas (la página nunca pierde un tipo).
  for (const x of catalogo) if (!vistos.has(x.tipo)) secciones.push({ tipo: x.tipo, visible: false, contenido: {} });
  return guardar('pagina-web', 'pagina', id, version, {
    seo_titulo: t(d.seo_titulo, 70), seo_descripcion: t(d.seo_descripcion, 170), secciones,
  });
}

// -----------------------------------------------------------------------------
// Menú principal y pie
// -----------------------------------------------------------------------------
export type ItemMenuEditable = { ubicacion: 'principal' | 'pie'; etiqueta: string; url: string; visible: boolean };

export async function guardarMenu(items: ItemMenuEditable[], version: string): Promise<ResultadoGuardar> {
  const limpios: ItemMenuEditable[] = [];
  for (const i of (Array.isArray(items) ? items : []).slice(0, 30)) {
    const etiqueta = t(i?.etiqueta, 40), url = t(i?.url, 300);
    if (!etiqueta && !url) continue;
    if (!etiqueta) return { ok: false, error: 'Cada enlace necesita un texto.' };
    if (!urlValida(url)) return { ok: false, error: `«${etiqueta}»: el destino debe empezar con / (página del sitio) o https://` };
    limpios.push({ ubicacion: i.ubicacion === 'pie' ? 'pie' : 'principal', etiqueta, url, visible: i.visible !== false });
  }
  return guardar('menu', 'menu', ID_CONJUNTO, version, { items: limpios });
}

// -----------------------------------------------------------------------------
// Información institucional (textos oficiales; los vacíos no se guardan)
// -----------------------------------------------------------------------------
const TIPOS_INSTITUCIONAL = ['identidad', 'quienes_somos', 'declaracion_fe', 'cifra', 'vision', 'historia'] as const;
export type ItemInstitucional = { tipo: (typeof TIPOS_INSTITUCIONAL)[number]; titulo: string; texto: string };

export async function guardarInstitucional(items: ItemInstitucional[], version: string): Promise<ResultadoGuardar> {
  const limpios: ItemInstitucional[] = [];
  for (const i of (Array.isArray(items) ? items : []).slice(0, 40)) {
    if (!TIPOS_INSTITUCIONAL.includes(i?.tipo)) continue;
    const titulo = t(i.titulo, 200), texto = t(i.texto, 5000);
    if (!titulo && !texto) continue;
    if (!titulo) return { ok: false, error: i.tipo === 'cifra' ? 'Cada cifra necesita su valor (ej.: +2.000).' : 'Cada texto necesita un título.' };
    limpios.push({ tipo: i.tipo, titulo, texto });
  }
  return guardar('institucional', 'institucional', ID_CONJUNTO, version, { items: limpios });
}
