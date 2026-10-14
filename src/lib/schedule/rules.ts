import type { Code, Rules } from "./types";

/**
 * Funciones puras que comprueban las reglas sobre la fila de UN empleado
 * (sus 7 casillas). Las usan tanto el generador (para no romper reglas)
 * como el validador (para avisar cuando el encargado las rompe a mano).
 */

/** Devuelve los días que forman parte de una racha de noches demasiado larga. */
export function nightRunViolations(row: Code[], maxConsecutive: number): number[] {
  const bad = new Set<number>();
  let start = -1;
  for (let d = 0; d <= row.length; d++) {
    const isNight = d < row.length && row[d] === "N";
    if (isNight && start === -1) start = d;
    if (!isNight && start !== -1) {
      if (d - start > maxConsecutive) for (let k = start; k < d; k++) bad.add(k);
      start = -1;
    }
  }
  return [...bad];
}

/** Devuelve los pares [noche, mañana siguiente] como días afectados. */
export function nightThenMorningViolations(row: Code[]): number[] {
  const bad: number[] = [];
  for (let d = 0; d + 1 < row.length; d++) {
    if (row[d] === "N" && row[d + 1] === "M") bad.push(d, d + 1);
  }
  return bad;
}

/** ¿La fila cumple todas las reglas? */
export function rowIsValid(row: Code[], rules: Rules): boolean {
  if (nightRunViolations(row, rules.maxConsecutiveNights).length > 0) return false;
  if (rules.forbidNightThenMorning && nightThenMorningViolations(row).length > 0) return false;
  return true;
}
