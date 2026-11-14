import type { Actividad } from './tipos';

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const nombreMes = (mes: number | null | undefined) => (mes && mes >= 1 && mes <= 12 ? mayuscula(MESES[mes - 1]) : null);

/** Fecha de una actividad tal como está en la base; null si no hay fecha. */
export function fechaActividad(a: Pick<Actividad, 'fecha_inicio' | 'fecha_fin' | 'fecha_precision'>): string | null {
  if (!a.fecha_inicio) return null;
  const [y, m, d] = a.fecha_inicio.split('-').map(Number);
  if (a.fecha_precision === 'mes') return `${mayuscula(MESES[m - 1])} ${y}`;
  if (a.fecha_fin && a.fecha_fin !== a.fecha_inicio) {
    const [y2, m2, d2] = a.fecha_fin.split('-').map(Number);
    if (y2 === y && m2 === m) return `${d} al ${d2} de ${MESES[m - 1]} de ${y}`;
    return `${d} de ${MESES[m - 1]} al ${d2} de ${MESES[m2 - 1]} de ${y2}`;
  }
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

export function fechaLarga(iso: string): string {
  const f = new Date(iso);
  return `${f.getUTCDate()} de ${MESES[f.getUTCMonth()]} de ${f.getUTCFullYear()}`;
}

const TIPOS: Record<string, string> = {
  convencion: 'Convención',
  encuentro: 'Encuentro',
  zonal: 'Zonal',
  formacion: 'Formación',
  mujeres: 'Encuentro de mujeres',
};

/** Etiqueta corta de una actividad: «Convención · 2026». */
export const etiquetaActividad = (a: Pick<Actividad, 'tipo' | 'anio'>) =>
  `${TIPOS[a.tipo] ?? mayuscula(a.tipo)} · ${a.anio}`;

export const dosDigitos = (n: number | null | undefined) => String(n ?? 0).padStart(2, '0');

export const recortar = (s: string, max = 160) => (s.length <= max ? s : `${s.slice(0, max).replace(/\s+\S*$/, '')}…`);

/** id de YouTube a partir de una URL (watch, youtu.be, embed o shorts). */
export function idYoutube(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null;
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    const m = u.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}
