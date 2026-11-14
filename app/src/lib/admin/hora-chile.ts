/**
 * Fechas del panel en horario de Chile continental (America/Santiago), con
 * su cambio de horario de verano/invierno. La base guarda todo en UTC.
 */
export const ZONA_CHILE = 'America/Santiago';

function partesEnZona(fecha: Date, zona = ZONA_CHILE) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: zona, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(f.formatToParts(fecha).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

/** Diferencia (ms) entre la hora de Chile y UTC en ese instante. */
function desfase(fecha: Date): number {
  const p = partesEnZona(fecha);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(fecha.getTime() / 1000) * 1000;
}

/**
 * «2026-11-20T18:30» (hora de Chile, como la entrega <input type="datetime-local">)
 * → instante UTC. Devuelve null si el texto no es una fecha válida.
 */
export function chileAUtc(local: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const comoUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Dos pasadas: el desfase puede cambiar justo en el cambio de horario.
  let t = comoUtc - desfase(new Date(comoUtc));
  t = comoUtc - desfase(new Date(t));
  const r = new Date(t);
  const p = partesEnZona(r);
  // Hora inexistente (se adelanta el reloj): se usa la siguiente hora válida.
  if (p.y !== y || p.m !== mo || p.d !== d) return null;
  return r;
}

/** Instante → «2026-11-20T18:30» en hora de Chile (para el campo datetime-local). */
export function utcAChileLocal(iso: string | Date): string {
  const p = partesEnZona(new Date(iso));
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${p.y}-${dos(p.m)}-${dos(p.d)}T${dos(p.h)}:${dos(p.min)}`;
}

/** «20 nov 2026, 18:30» en hora de Chile. */
export function fechaHoraChile(iso: string | Date): string {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: ZONA_CHILE, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(iso)).replace(/\./g, '');
}

/** «20 nov 2026» en hora de Chile. */
export function fechaChile(iso: string | Date): string {
  return new Intl.DateTimeFormat('es-CL', { timeZone: ZONA_CHILE, day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(iso)).replace(/\./g, '');
}

/** «hace 5 min», «hace 2 h», «ayer»… */
export function haceCuanto(iso: string | Date, ahora = new Date()): string {
  const s = Math.max(0, Math.round((ahora.getTime() - new Date(iso).getTime()) / 1000));
  if (s < 45) return 'hace un momento';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  if (s < 172800) return 'ayer';
  return fechaChile(iso);
}
