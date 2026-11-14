/**
 * Secciones del panel /admin y qué roles pueden entrar a cada una
 * (docs/roles-permisos.md). Lo usan el proxy (403 en el servidor), las
 * páginas, las acciones del servidor y la barra lateral.
 *
 * Este archivo no importa nada del servidor: también lo usa el proxy.
 */
export type Rol = 'superadmin' | 'editor' | 'eventos' | 'multimedia';

export const NOMBRE_ROL: Record<Rol, string> = {
  superadmin: 'Superadministrador',
  editor: 'Editor',
  eventos: 'Eventos',
  multimedia: 'Multimedia',
};

export type ClaveSeccion =
  | 'escritorio' | 'cuenta'
  | 'articulos' | 'series' | 'eventos'
  | 'pagina-web' | 'institucional' | 'menu'
  | 'fotos' | 'galerias' | 'videos'
  | 'usuarios' | 'registro' | 'configuracion';

export type Seccion = {
  clave: ClaveSeccion;
  nombre: string;
  icono: string;
  ruta: string;
  roles: Rol[] | 'todos';
  /** false: la sección llega en una etapa siguiente (la navegación ya está lista). */
  lista: boolean;
};

const S: Rol = 'superadmin', E: Rol = 'editor', V: Rol = 'eventos', M: Rol = 'multimedia';

/** Grupos y elementos de la barra lateral, en el orden del diseño (AdminSidebar). */
export const GRUPOS: { titulo: string; secciones: Seccion[] }[] = [
  { titulo: 'General', secciones: [
    { clave: 'escritorio', nombre: 'Escritorio', icono: '◧', ruta: '/admin', roles: 'todos', lista: true },
  ] },
  { titulo: 'Contenido', secciones: [
    { clave: 'articulos', nombre: 'Artículos', icono: '✎', ruta: '/admin/articulos', roles: [S, E], lista: true },
    { clave: 'series', nombre: 'Series y categorías', icono: '#', ruta: '/admin/articulos/series', roles: [S, E], lista: true },
    { clave: 'eventos', nombre: 'Eventos y actividades', icono: '◷', ruta: '/admin/eventos', roles: [S, V], lista: false },
  ] },
  { titulo: 'Sitio web', secciones: [
    { clave: 'pagina-web', nombre: 'Administrar página web', icono: '▤', ruta: '/admin/pagina-web', roles: [S], lista: false },
    { clave: 'institucional', nombre: 'Información institucional', icono: 'ℹ', ruta: '/admin/institucional', roles: [S], lista: false },
    { clave: 'menu', nombre: 'Menú, enlaces y pie', icono: '☰', ruta: '/admin/menu', roles: [S], lista: false },
  ] },
  { titulo: 'Multimedia', secciones: [
    { clave: 'fotos', nombre: 'Biblioteca de fotos', icono: '▣', ruta: '/admin/fotos', roles: [S, M, E, V], lista: true },
    { clave: 'galerias', nombre: 'Galerías y álbumes', icono: '❐', ruta: '/admin/galerias', roles: [S, M], lista: false },
    { clave: 'videos', nombre: 'Videos', icono: '▶', ruta: '/admin/videos', roles: [S, M], lista: false },
  ] },
  { titulo: 'Administración', secciones: [
    { clave: 'usuarios', nombre: 'Usuarios y roles', icono: '⚿', ruta: '/admin/usuarios', roles: [S], lista: false },
    { clave: 'registro', nombre: 'Registro de actividad', icono: '≡', ruta: '/admin/registro', roles: [S], lista: false },
    { clave: 'configuracion', nombre: 'Configuración', icono: '⚙', ruta: '/admin/configuracion', roles: [S], lista: false },
  ] },
];

const CUENTA: Seccion = { clave: 'cuenta', nombre: 'Mi cuenta', icono: '◉', ruta: '/admin/cuenta', roles: 'todos', lista: true };

export const SECCIONES: Seccion[] = [...GRUPOS.flatMap((g) => g.secciones), CUENTA];

export const seccion = (clave: ClaveSeccion): Seccion => SECCIONES.find((s) => s.clave === clave)!;

/**
 * ¿Puede entrar a la sección? `efectivos` son los roles que la base de datos
 * reconoce en esta sesión (mi_acceso().efectivos), no solo los asignados.
 */
export function puedeEntrar(clave: ClaveSeccion, efectivos: readonly Rol[], asignados: readonly Rol[] = efectivos): boolean {
  const s = seccion(clave);
  if (s.roles === 'todos') return asignados.length > 0;
  return s.roles.some((r) => efectivos.includes(r));
}

/** Rutas del panel que no exigen sesión. */
export const RUTAS_PUBLICAS = ['/admin/ingresar', '/admin/recuperar', '/admin/auth/confirmar'];

/** Rutas con sesión pero fuera de las secciones (pasos de acceso y 403). */
export const RUTAS_DE_ACCESO = ['/admin/verificar', '/admin/doble-factor', '/admin/nueva-clave', '/admin/salir', '/admin/sin-permiso'];

/** Sección a la que pertenece una ruta del panel (la más específica). */
export function seccionDeRuta(ruta: string): ClaveSeccion | null {
  const limpia = ruta.replace(/\/+$/, '') || '/';
  if (limpia === '/admin') return 'escritorio';
  let mejor: Seccion | null = null;
  for (const s of SECCIONES) {
    if (s.ruta === '/admin') continue;
    if (limpia === s.ruta || limpia.startsWith(`${s.ruta}/`)) {
      if (!mejor || s.ruta.length > mejor.ruta.length) mejor = s;
    }
  }
  return mejor?.clave ?? null;
}

/** Valida un destino interno (evita redirecciones abiertas). */
export function destinoSeguro(valor: unknown, porDefecto = '/admin'): string {
  if (typeof valor !== 'string') return porDefecto;
  if (!valor.startsWith('/admin') || valor.startsWith('//') || valor.includes('\\')) return porDefecto;
  if (RUTAS_PUBLICAS.some((r) => valor.startsWith(r))) return porDefecto;
  return valor;
}
