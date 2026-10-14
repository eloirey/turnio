/**
 * Tipos del dominio de cuadrantes.
 *
 * Convención de días: índice 0 = lunes … 6 = domingo (semana ISO).
 * Así un cuadrante semanal es siempre un array de 7 posiciones.
 */

/** Franjas de trabajo: Mañana, Tarde, Noche. */
export type Slot = "M" | "T" | "N";

/** Lo que puede haber en una casilla del cuadrante: una franja o Libre. */
export type Code = Slot | "L";

export const SLOTS: readonly Slot[] = ["M", "T", "N"] as const;
export const DAYS_IN_WEEK = 7;

export interface ShiftDef {
  code: Slot;
  label: string; // "Mañana"
  start: string; // "09:00"
  end: string; // "17:00"
  hours: number;
}

export type ShiftCatalog = Record<Slot, ShiftDef>;

export interface Employee {
  id: string;
  name: string;
  /** Puesto: "sala", "cocina", "barra"… lo define cada local. */
  role: string;
  contractHours: number;
  /** availability[franja][día] === true si puede trabajar esa franja ese día. */
  availability: Record<Slot, boolean[]>;
}

/**
 * Cuánta gente hace falta: demand[día][franja][puesto] = número de personas.
 * Ejemplo: demand[4].N = { sala: 1, barra: 1 } → el viernes por la noche
 * hacen falta 1 persona de sala y 1 de barra.
 */
export type DayDemand = Partial<Record<Slot, Record<string, number>>>;
export type Demand = DayDemand[];

/** El cuadrante: para cada empleado (por id), 7 casillas. */
export type Grid = Record<string, Code[]>;

export interface Rules {
  /** Máximo de noches (cierres) seguidas. Por defecto 2. */
  maxConsecutiveNights: number;
  /** Prohibido entrar de mañana justo después de cerrar la noche anterior. */
  forbidNightThenMorning: boolean;
}

export interface Gap {
  day: number;
  slot: Slot;
  role: string;
  missing: number;
}

export type IssueKind =
  | "consecutive-nights"
  | "night-then-morning"
  | "outside-availability"
  | "over-contract";

export interface Issue {
  kind: IssueKind;
  employeeId: string;
  /** Días afectados (para marcar las casillas en rojo). */
  days: number[];
}
