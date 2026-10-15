import { FREE, type Code, type Employee, type Rules, type ShiftCatalog } from "./types";

/**
 * Funciones puras que comprueban las reglas sobre la fila de UN empleado
 * (sus 7 casillas). Las usan el generador (para no romper reglas) y el
 * validador (para avisar cuando el encargado las rompe a mano).
 */

/** "17:30" → 17,5 */
export function toHours(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h + (m || 0) / 60;
}

/** Duración de una franja en horas (si termina antes de empezar, cruza la medianoche). */
export function spanHours(start: string, end: string): number {
  const s = toHours(start);
  let e = toHours(end);
  if (e <= s) e += 24;
  return Math.round((e - s) * 100) / 100;
}

/** Horas de una casilla (0 si es libre o la franja no existe). */
export function codeHours(code: Code, shifts: ShiftCatalog): number {
  return code === FREE ? 0 : (shifts[code]?.hours ?? 0);
}

/** Inicio y fin de una franja en horas absolutas desde el lunes a las 00:00. */
export function shiftWindow(day: number, code: Code, shifts: ShiftCatalog) {
  const def = shifts[code];
  const s = toHours(def.start);
  let e = toHours(def.end);
  if (e <= s) e += 24; // termina al día siguiente (p. ej. 17:00–01:00)
  return { start: day * 24 + s, end: day * 24 + e };
}

/** ¿La casilla es un cierre? */
export function isClosing(code: Code, shifts: ShiftCatalog): boolean {
  return code !== FREE && Boolean(shifts[code]?.closing);
}

/** Días que forman parte de una racha de cierres demasiado larga. */
export function nightRunViolations(row: Code[], maxConsecutive: number, shifts: ShiftCatalog): number[] {
  const bad = new Set<number>();
  let start = -1;
  for (let d = 0; d <= row.length; d++) {
    const closing = d < row.length && isClosing(row[d], shifts);
    if (closing && start === -1) start = d;
    if (!closing && start !== -1) {
      if (d - start > maxConsecutive) for (let k = start; k < d; k++) bad.add(k);
      start = -1;
    }
  }
  return [...bad];
}

/**
 * Pares de días consecutivos con menos descanso del mínimo entre el fin de
 * una jornada y el inicio de la siguiente. Usa los horarios reales de las
 * franjas, así que funciona con cualquier configuración del local.
 */
export function restViolations(row: Code[], shifts: ShiftCatalog, minRestHours: number): number[] {
  const bad: number[] = [];
  for (let d = 0; d + 1 < row.length; d++) {
    const a = row[d];
    const b = row[d + 1];
    if (a === FREE || b === FREE || !shifts[a] || !shifts[b]) continue;
    const rest = shiftWindow(d + 1, b, shifts).start - shiftWindow(d, a, shifts).end;
    if (rest < minRestHours) bad.push(d, d + 1);
  }
  return bad;
}

/** Días que el empleado trabaja en la semana. */
export function workDays(row: Code[]): number {
  return row.filter((c) => c !== FREE).length;
}

/** Reglas que se aplican a una persona: las suyas si las tiene, si no las del local. */
export function rulesFor(employee: Pick<Employee, "minDaysOff" | "maxConsecutiveClosings">, rules: Rules): Rules {
  return {
    ...rules,
    minDaysOff: employee.minDaysOff ?? rules.minDaysOff,
    maxConsecutiveNights: employee.maxConsecutiveClosings ?? rules.maxConsecutiveNights,
  };
}

/** ¿La fila cumple todas las reglas? */
export function rowIsValid(row: Code[], shifts: ShiftCatalog, rules: Rules): boolean {
  if (workDays(row) > row.length - rules.minDaysOff) return false;
  if (nightRunViolations(row, rules.maxConsecutiveNights, shifts).length > 0) return false;
  if (restViolations(row, shifts, rules.minRestHours).length > 0) return false;
  return true;
}
