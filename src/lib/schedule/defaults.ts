import type { Rules, ShiftCatalog } from "./types";

/** Franjas por defecto. Cada local puede editarlas en "Necesidades". */
export const DEFAULT_SHIFTS: ShiftCatalog = {
  M: { code: "M", label: "Mañana", start: "09:00", end: "17:00", hours: 8 },
  T: { code: "T", label: "Tarde", start: "13:00", end: "21:00", hours: 8 },
  N: { code: "N", label: "Noche", start: "17:00", end: "01:00", hours: 8 },
};

/**
 * Reglas por defecto, alineadas con el Estatuto de los Trabajadores:
 * 12 h de descanso entre jornadas (art. 34.3) y dos días libres por semana,
 * lo habitual en los convenios de hostelería y comercio.
 */
export const DEFAULT_RULES: Rules = {
  maxConsecutiveNights: 2,
  minRestHours: 12,
  minDaysOff: 2,
};
