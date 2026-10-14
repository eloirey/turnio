import type { Rules, ShiftCatalog } from "./types";

/** Franjas por defecto. En la app real cada local podrá editarlas. */
export const DEFAULT_SHIFTS: ShiftCatalog = {
  M: { code: "M", label: "Mañana", start: "09:00", end: "17:00", hours: 8 },
  T: { code: "T", label: "Tarde", start: "13:00", end: "21:00", hours: 8 },
  N: { code: "N", label: "Noche", start: "17:00", end: "01:00", hours: 8 },
};

export const DEFAULT_RULES: Rules = {
  maxConsecutiveNights: 2,
  forbidNightThenMorning: true,
};
