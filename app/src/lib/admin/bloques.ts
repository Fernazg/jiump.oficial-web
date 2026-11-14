import type { Bloque } from '@/lib/tipos';

/**
 * Tipos de bloque del cuerpo de un artículo (docs/modelo-datos.md › «Bloques
 * del cuerpo»). Lo usan el editor (navegador) y las acciones del servidor,
 * que vuelven a validar todo lo que llega.
 */
export type TipoBloque = Bloque['tipo'];

export const TIPOS_BLOQUE: { tipo: TipoBloque; nombre: string; ayuda: string }[] = [
  { tipo: 'parrafo', nombre: 'Párrafo', ayuda: 'Texto normal. Marca **negritas** con el botón B.' },
  { tipo: 'entradilla', nombre: 'Entradilla', ayuda: 'Primer párrafo destacado, con letra capital.' },
  { tipo: 'titulo_seccion', nombre: 'Título de sección', ayuda: 'Aparece numerado y en el índice «En este artículo».' },
  { tipo: 'pregunta_destacada', nombre: 'Pregunta destacada', ayuda: 'Una pregunta en letra grande.' },
  { tipo: 'versiculo', nombre: 'Versículo', ayuda: 'Cita bíblica en recuadro, con su referencia.' },
  { tipo: 'idea_clave', nombre: 'Idea clave', ayuda: 'Frase importante con línea lateral.' },
  { tipo: 'para_recordar', nombre: 'Para recordar', ayuda: 'Recuadro de color con la conclusión.' },
  { tipo: 'lista_numerada', nombre: 'Lista numerada', ayuda: 'Pasos o puntos en orden.' },
  { tipo: 'tarjetas', nombre: 'Tarjetas', ayuda: 'Puntos en tarjetas numeradas, con título opcional.' },
  { tipo: 'linea_tiempo', nombre: 'Línea de tiempo', ayuda: 'Fechas con un texto cada una.' },
  { tipo: 'cifras', nombre: 'Cifras', ayuda: 'Números destacados con su explicación.' },
  { tipo: 'imagen', nombre: 'Imagen', ayuda: 'Una foto de la biblioteca, con pie opcional.' },
  { tipo: 'video', nombre: 'Video', ayuda: 'Un video de YouTube.' },
];

export const nombreBloque = (t: TipoBloque) => TIPOS_BLOQUE.find((x) => x.tipo === t)?.nombre ?? t;

export function bloqueVacio(tipo: TipoBloque): Bloque {
  switch (tipo) {
    case 'versiculo': return { tipo, texto: '', referencia: '' };
    case 'idea_clave': case 'para_recordar': return { tipo, texto: '' };
    case 'lista_numerada': return { tipo, items: [''] };
    case 'tarjetas': return { tipo, titulo: '', items: [''] };
    case 'linea_tiempo': return { tipo, items: [{ fecha: '', texto: '' }] };
    case 'cifras': return { tipo, items: [{ valor: '', texto: '' }] };
    case 'imagen': return { tipo, foto_id: '' };
    case 'video': return { tipo, url: '', titulo: '' };
    default: return { tipo, texto: '' } as Bloque;
  }
}

const LIMITE_TEXTO = 20_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const txt = (v: unknown) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').slice(0, LIMITE_TEXTO).trim() : '');
const opcional = (v: unknown) => txt(v) || undefined;
const lista = (v: unknown) => (Array.isArray(v) ? v.slice(0, 200) : []);

export const esYoutube = (url: string) => /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//.test(url);

/**
 * Limpia el cuerpo que llega del navegador: solo tipos conocidos, solo sus
 * campos, textos recortados. Descarta bloques vacíos (no se publica nada a
 * medio llenar) y devuelve también los avisos para el editor.
 */
export function limpiarCuerpo(entrada: unknown): Bloque[] {
  const salida: Bloque[] = [];
  for (const b of lista(entrada).slice(0, 500)) {
    if (!b || typeof b !== 'object') continue;
    const o = b as Record<string, unknown>;
    switch (o.tipo) {
      case 'parrafo': case 'entradilla': case 'titulo_seccion': case 'pregunta_destacada': {
        const texto = txt(o.texto);
        if (texto) salida.push({ tipo: o.tipo, texto });
        break;
      }
      case 'versiculo': {
        const texto = txt(o.texto), referencia = txt(o.referencia);
        if (texto || referencia) salida.push({ tipo: 'versiculo', texto, referencia, ...(opcional(o.etiqueta) ? { etiqueta: opcional(o.etiqueta) } : {}) });
        break;
      }
      case 'idea_clave': case 'para_recordar': {
        const texto = txt(o.texto);
        if (texto) salida.push({ tipo: o.tipo, texto, ...(opcional(o.etiqueta) ? { etiqueta: opcional(o.etiqueta) } : {}) });
        break;
      }
      case 'lista_numerada': {
        const items = lista(o.items).map(txt).filter(Boolean);
        if (items.length) salida.push({ tipo: 'lista_numerada', items });
        break;
      }
      case 'tarjetas': {
        const items = lista(o.items).map(txt).filter(Boolean);
        if (items.length) salida.push({ tipo: 'tarjetas', items, ...(opcional(o.titulo) ? { titulo: opcional(o.titulo) } : {}) });
        break;
      }
      case 'linea_tiempo': {
        const items = lista(o.items).map((i) => ({ fecha: txt((i as Record<string, unknown>)?.fecha), texto: txt((i as Record<string, unknown>)?.texto) }))
          .filter((i) => i.fecha || i.texto);
        if (items.length) salida.push({ tipo: 'linea_tiempo', items });
        break;
      }
      case 'cifras': {
        const items = lista(o.items).map((i) => ({ valor: txt((i as Record<string, unknown>)?.valor), texto: txt((i as Record<string, unknown>)?.texto) }))
          .filter((i) => i.valor || i.texto);
        if (items.length) salida.push({ tipo: 'cifras', items });
        break;
      }
      case 'imagen': {
        const foto = txt(o.foto_id);
        if (UUID.test(foto)) salida.push({ tipo: 'imagen', foto_id: foto, ...(opcional(o.pie) ? { pie: opcional(o.pie) } : {}) });
        break;
      }
      case 'video': {
        const url = txt(o.url);
        if (esYoutube(url)) salida.push({ tipo: 'video', url, ...(opcional(o.titulo) ? { titulo: opcional(o.titulo) } : {}) });
        break;
      }
      default:
        break; // tipo desconocido: se descarta
    }
  }
  return salida;
}

/** Slug desde un título: «¿Cómo comenzó la Biblia?» → «como-comenzo-la-biblia». */
export function slugDesde(texto: string): string {
  return texto
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 80).replace(/-+$/g, '') || 'articulo';
}

export const esUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
