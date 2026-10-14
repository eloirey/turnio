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
  end: string; // "17:00" (si es menor que start, termina al día siguiente)
  hours: number;
}

export type ShiftCatalog = Record<Slot, ShiftDef>;

export interface Employee {
  id: string;
  name: string;
  /** Clave del puesto ("sala", "caja"…): cada local define los suyos. */
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

/**
 * Ausencias de la semana: para cada empleado, 7 posiciones con el motivo
 * ("vacaciones", "baja"…) o null si ese día está disponible.
 */
export type AbsenceMap = Record<string, (string | null)[]>;

export interface Rules {
  /** Máximo de noches (cierres) seguidas. Por defecto 2. */
  maxConsecutiveNights: number;
  /** Horas mínimas de descanso entre el fin de una jornada y el inicio de la siguiente (Estatuto: 12). */
  minRestHours: number;
  /** Días libres mínimos por semana. */
  minDaysOff: number;
}

export interface Gap {
  day: number;
  slot: Slot;
  role: string;
  missing: number;
}

export type IssueKind =
  | "consecutive-nights"
  | "short-rest"
  | "absence-conflict"
  | "outside-availability"
  | "too-few-days-off"
  | "over-contract";

export interface Issue {
  kind: IssueKind;
  employeeId: string;
  /** Días afectados (para marcar las casillas en rojo). */
  days: number[];
}
