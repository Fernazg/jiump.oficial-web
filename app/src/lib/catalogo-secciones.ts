/**
 * Secciones de cada página que se administran desde «Administrar página web».
 * Las editables tienen campos (textos, botones, fotos, tarjetas); las
 * automáticas muestran contenido publicado de otras secciones del panel y
 * solo se ordenan, se muestran u ocultan. El diseño de cada una es fijo:
 * así la página siempre se ve bien. Lo usan el sitio y el panel.
 */
export type ClavePaginaWeb = 'inicio' | 'nosotros' | 'eventos' | 'articulos' | 'galeria';

export type Campo =
  | { tipo: 'texto'; clave: string; nombre: string; max: number; largo?: boolean }
  | { tipo: 'boton'; clave: string; nombre: string }
  | { tipo: 'foto'; clave: string; nombre: string }
  | { tipo: 'fotos'; clave: string; nombre: string; max: number }
  | { tipo: 'tarjetas'; clave: string; nombre: string; max: number };

export type TipoSeccion = { tipo: string; nombre: string; resumen: string; campos: Campo[] };

const portadaInicio: TipoSeccion = {
  tipo: 'portada', nombre: 'Portada principal', resumen: 'Foto de fondo y título grande del inicio.',
  campos: [
    { tipo: 'texto', clave: 'titulo', nombre: 'Título principal (si se deja vacío: el nombre del movimiento)', max: 60 },
    { tipo: 'foto', clave: 'foto_id', nombre: 'Foto de fondo' },
  ],
};

export const CATALOGO: Record<ClavePaginaWeb, TipoSeccion[]> = {
  inicio: [
    portadaInicio,
    { tipo: 'presentacion', nombre: 'Presentación y cifras', resumen: 'Frase de presentación; las cifras vienen de «Información institucional».',
      campos: [{ tipo: 'texto', clave: 'etiqueta', nombre: 'Etiqueta superior', max: 60 }, { tipo: 'texto', clave: 'texto', nombre: 'Texto', max: 240, largo: true }] },
    { tipo: 'que_hacemos', nombre: 'Qué hacemos', resumen: 'Título, enlace y tarjetas con foto.',
      campos: [
        { tipo: 'texto', clave: 'etiqueta', nombre: 'Etiqueta superior', max: 60 },
        { tipo: 'texto', clave: 'titulo', nombre: 'Título', max: 80 },
        { tipo: 'boton', clave: 'enlace', nombre: 'Enlace' },
        { tipo: 'tarjetas', clave: 'tarjetas', nombre: 'Tarjetas', max: 8 },
      ] },
    { tipo: 'destacado', nombre: 'Bloque destacado («Heme aquí»)', resumen: 'Bloque azul con título, texto, botón y hasta 3 fotos.',
      campos: [
        { tipo: 'texto', clave: 'etiqueta', nombre: 'Etiqueta superior', max: 60 },
        { tipo: 'texto', clave: 'titulo', nombre: 'Título', max: 60 },
        { tipo: 'texto', clave: 'texto', nombre: 'Texto', max: 240, largo: true },
        { tipo: 'boton', clave: 'boton', nombre: 'Botón' },
        { tipo: 'fotos', clave: 'fotos', nombre: 'Fotos', max: 3 },
      ] },
    { tipo: 'actividades_destacadas', nombre: 'Actividades destacadas', resumen: 'Automática: las actividades marcadas «Destacar en Inicio».', campos: [] },
    { tipo: 'eventos', nombre: 'Eventos', resumen: 'Automática: el «Próximo evento» o el aviso de que aún no hay.', campos: [] },
    { tipo: 'articulos_recientes', nombre: 'Artículos recientes', resumen: 'Automática: los últimos artículos publicados.', campos: [] },
    { tipo: 'momentos', nombre: 'Momentos JIUMP', resumen: 'Automática: álbumes publicados de la Galería.', campos: [] },
  ],
  nosotros: [
    { tipo: 'portada', nombre: 'Portada', resumen: 'Foto de fondo de la página.', campos: [{ tipo: 'foto', clave: 'foto_id', nombre: 'Foto de fondo' }] },
    { tipo: 'identidad', nombre: 'Identidad y «Quiénes somos»', resumen: 'Automática: textos de «Información institucional».', campos: [] },
    { tipo: 'historia', nombre: 'Visión e historia', resumen: 'Automática: textos de «Información institucional».', campos: [] },
    { tipo: 'que_hacemos', nombre: 'Qué hacemos', resumen: 'Título, enlace y tarjetas con foto.',
      campos: [
        { tipo: 'texto', clave: 'etiqueta', nombre: 'Etiqueta superior', max: 60 },
        { tipo: 'texto', clave: 'titulo', nombre: 'Título', max: 80 },
        { tipo: 'boton', clave: 'enlace', nombre: 'Enlace' },
        { tipo: 'tarjetas', clave: 'tarjetas', nombre: 'Tarjetas', max: 8 },
      ] },
    { tipo: 'que_creemos', nombre: 'Qué creemos', resumen: 'Automática: declaraciones de fe de «Información institucional».', campos: [] },
    { tipo: 'invitacion', nombre: 'Invitación a eventos y artículos', resumen: 'Automática: bloque azul con enlaces a Eventos y Artículos.', campos: [] },
  ],
  eventos: [],
  articulos: [],
  galeria: [],
};

export const PAGINAS_WEB: { clave: ClavePaginaWeb; nombre: string; ruta: string }[] = [
  { clave: 'inicio', nombre: 'Inicio', ruta: '/' },
  { clave: 'nosotros', nombre: 'Nosotros', ruta: '/nosotros' },
  { clave: 'eventos', nombre: 'Eventos', ruta: '/eventos' },
  { clave: 'articulos', nombre: 'Artículos', ruta: '/articulos' },
  { clave: 'galeria', nombre: 'Galería', ruta: '/galeria' },
];

export const tipoSeccion = (pagina: ClavePaginaWeb, tipo: string) => CATALOGO[pagina].find((t) => t.tipo === tipo);

/**
 * Bloques a mostrar, en orden: las secciones visibles de la página (el
 * visitante solo recibe las visibles). Un tipo desconocido no se muestra.
 */
export function bloquesVisibles<S extends { tipo: string; orden?: number; visible?: boolean }>(pagina: ClavePaginaWeb, secciones: S[]): S[] {
  const conocidos = new Set(CATALOGO[pagina].map((t) => t.tipo));
  return [...secciones]
    .filter((s) => conocidos.has(s.tipo) && s.visible !== false)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
}

/** Destinos sugeridos para botones y enlaces (también se acepta cualquier https://). */
export const DESTINOS: { url: string; nombre: string }[] = [
  { url: '/', nombre: 'Página: Inicio' },
  { url: '/nosotros', nombre: 'Página: Nosotros' },
  { url: '/eventos', nombre: 'Página: Eventos' },
  { url: '/articulos', nombre: 'Página: Artículos' },
  { url: '/galeria', nombre: 'Página: Galería' },
];
