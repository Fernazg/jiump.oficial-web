// Tipos de las filas públicas que lee el sitio (ver supabase/migrations/).

export type Foto = {
  id: string;
  archivo: string;
  ancho: number | null;
  alto: number | null;
  texto_alternativo: string;
  credito: string | null;
};

/** Foto lista para mostrar: con su URL firmada (el bucket es privado). */
export type FotoFirmada = Foto & { url: string };

export type Serie = {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  tipo: 'mes' | 'tematica';
  mes: number | null;
  color: 'azul' | 'rojo' | 'neutro';
  icono: string | null;
  orden: number;
};

export type Tema = { id: string; nombre: string; slug: string };

export type Articulo = {
  id: string;
  titulo: string;
  slug: string;
  bajada: string | null;
  autor: string | null;
  serie_id: string | null;
  parte: number | null;
  portada_foto_id: string | null;
  cuerpo: Bloque[];
  estado: string;
  publicado_en: string | null;
  minutos_lectura: number;
};

export type Actividad = {
  id: string;
  titulo: string;
  slug: string;
  tipo: string;
  anio: number;
  fecha_inicio: string | null;
  fecha_precision: 'dia' | 'mes';
  fecha_fin: string | null;
  lugar: string | null;
  zona: string | null;
  introduccion: string | null;
  portada_foto_id: string | null;
  destacar_inicio: boolean;
  orden_inicio: number;
  es_proximo: boolean;
  lema: string | null;
  cita_texto: string | null;
  cita_referencia: string | null;
  abreviatura: string | null;
};

export type Album = {
  id: string;
  titulo: string;
  slug: string;
  descripcion: string | null;
  anio: number | null;
  pais: string | null;
  ciudad: string | null;
  actividad_id: string | null;
  portada_foto_id: string | null;
  orden: number;
};

export type Video = { id: string; url: string; titulo: string; descripcion: string | null; album_id: string | null; actividad_id: string | null };

export type Enlace = { id: string; url: string; titulo: string; orden: number };

export type SeccionActividad = { id: string; titulo: string; contenido: Bloque[]; orden: number };

export type Institucional = { id: string; tipo: string; titulo: string; texto: string | null; orden: number };

export type SeccionPagina = { id: string; tipo: string; orden: number; contenido: Record<string, unknown> };

export type ItemMenu = { id: string; ubicacion: 'principal' | 'pie'; etiqueta: string; url: string; orden: number };

export type Configuracion = {
  modo_mantenimiento: boolean;
  instagram_url: string | null;
  mostrar_barra_proximo_evento: boolean;
  seo_titulo: string | null;
  seo_descripcion: string | null;
  mantenimiento_foto_id: string | null;
};

// -----------------------------------------------------------------------------
// Bloques del cuerpo (articulos.cuerpo y actividad_secciones.contenido).
// Ver docs/modelo-datos.md › «Bloques del cuerpo».
// -----------------------------------------------------------------------------
export type Bloque =
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'entradilla'; texto: string }
  | { tipo: 'titulo_seccion'; texto: string }
  | { tipo: 'pregunta_destacada'; texto: string }
  | { tipo: 'versiculo'; texto: string; referencia: string; etiqueta?: string }
  | { tipo: 'idea_clave'; texto: string; etiqueta?: string }
  | { tipo: 'para_recordar'; texto: string; etiqueta?: string }
  | { tipo: 'lista_numerada'; items: string[] }
  | { tipo: 'tarjetas'; titulo?: string; items: string[] }
  | { tipo: 'linea_tiempo'; items: { fecha: string; texto: string }[] }
  | { tipo: 'cifras'; items: { valor: string; texto: string }[] }
  | { tipo: 'imagen'; foto_id: string; pie?: string }
  | { tipo: 'video'; url: string; titulo?: string };
