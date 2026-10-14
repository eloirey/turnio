/**
 * Fechas de calendario como texto "YYYY-MM-DD".
 *
 * Por qué texto y no Date: un Date es un instante (con hora y zona horaria) y
 * "2026-10-12" puede convertirse en el día 11 según la zona del servidor.
 * Trabajando en UTC y guardando solo la fecha evitamos ese error clásico.
 */

const MS_DAY = 86_400_000;

function toUTC(iso: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error(`Fecha no válida: ${iso}`);
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) throw new Error(`Fecha no válida: ${iso}`);
  return d;
}

function fromUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isValidISODate(iso: string): boolean {
  try {
    toUTC(iso);
    return true;
  } catch {
    return false;
  }
}

export function addDays(iso: string, days: number): string {
  return fromUTC(new Date(toUTC(iso).getTime() + days * MS_DAY));
}

/** Lunes de la semana que contiene la fecha dada. */
export function mondayOf(iso: string): string {
  const d = toUTC(iso);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes … 6 = domingo
  return addDays(iso, -dow);
}

/** Hoy en la zona horaria de Madrid (donde están los clientes). */
export function todayInMadrid(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(now);
}

/** Número de semana ISO 8601 (la semana 1 es la que contiene el primer jueves del año). */
export function isoWeekNumber(iso: string): number {
  const monday = mondayOf(iso);
  const thursday = toUTC(addDays(monday, 3));
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - yearStart) / MS_DAY / 7) + 1;
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export const DAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;
export const DAY_LONG = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"] as const;

/** Día del mes para el día `index` (0–6) de la semana que empieza en `monday`. */
export function dayOfMonth(monday: string, index: number): number {
  return toUTC(addDays(monday, index)).getUTCDate();
}

/** "12 – 18 octubre" o "28 septiembre – 4 octubre". */
export function weekRangeLabel(monday: string): string {
  const a = toUTC(monday);
  const b = toUTC(addDays(monday, 6));
  const ma = MONTHS[a.getUTCMonth()];
  const mb = MONTHS[b.getUTCMonth()];
  return ma === mb
    ? `${a.getUTCDate()} – ${b.getUTCDate()} ${mb}`
    : `${a.getUTCDate()} ${ma} – ${b.getUTCDate()} ${mb}`;
}

/** "miércoles 14 de octubre". */
export function longDateLabel(iso: string): string {
  const d = toUTC(iso);
  return `${DAY_LONG[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
}
