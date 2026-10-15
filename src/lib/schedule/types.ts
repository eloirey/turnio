/**
 * Tipos del dominio de cuadrantes.
 *
 * Convención de días: índice 0 = lunes … 6 = domingo (semana ISO).
 * Así un cuadrante semanal es siempre un array de 7 posiciones.
 */

/**
 * Código de una franja. Cada local crea las suyas ("M", "L12", "P1"…);
 * "L" está reservado para "Libre".
 */
export type Slot = string;

/** Lo que puede haber en una casilla del cuadrante: el código de una franja o "L" (libre). */
export type Code = Slot;

export const FREE = "L";
export const DAYS_IN_WEEK = 7;
export const MAX_SLOTS = 8;

export interface ShiftDef {
  code: Slot;
  label: string; // "Mañana", "Línea 12"…
  start: string; // "09:00"
  end: string; // "17:00" (si es menor o igual que start, termina al día siguiente)
  /** Turno partido: segundo tramo del mismo día ("20:00"–"00:00"). */
  start2?: string | null;
  end2?: string | null;
  hours: number;
  /** Cuenta como "cierre" para la regla de cierres seguidos (p. ej. la noche). */
  closing: boolean;
  /** Posición en pantalla. */
  order: number;
  /** Las franjas archivadas siguen en el catálogo para mostrar semanas antiguas. */
  active: boolean;
}

export type ShiftCatalog = Record<Slot, ShiftDef>;

/** Códigos de las franjas activas, en el orden del local. */
export function activeSlots(shifts: ShiftCatalog): Slot[] {
  return Object.values(shifts)
    .filter((s) => s.active)
    .sort((a, b) => a.order - b.order || a.code.localeCompare(b.code))
    .map((s) => s.code);
}

export interface Employee {
  id: string;
  name: string;
  /** Clave del puesto ("sala", "caja"…): cada local define los suyos. */
  role: string;
  contractHours: number;
  /** availability[franja][día] === true si puede trabajar esa franja ese día. */
  availability: Record<Slot, boolean[]>;
  /** Reglas propias (si no hay, se usan las del local). */
  minDaysOff?: number | null;
  maxConsecutiveClosings?: number | null;
  /** Días que prefiere librar (0 = lunes). El generador intenta respetarlos. */
  preferredDaysOff?: number[];
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
  /** Máximo de cierres (franjas marcadas como cierre) seguidos. Por defecto 2. */
  maxConsecutiveNights: number;
  /** Horas mínimas de descanso entre el fin de una jornada y el inicio de la siguiente (Estatuto: 12). */
  minRestHours: number;
  /** Días libres mínimos por semana. */
  minDaysOff: number;
  /** Horas que se pueden pasar del contrato en una semana (horas extra). */
  maxExtraHours: number;
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
