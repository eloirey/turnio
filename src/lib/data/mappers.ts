/**
 * Traducción entre las filas de la base de datos (en castellano, una fila por
 * dato) y los tipos del dominio que usa el generador (en inglés, estructuras).
 * Son funciones puras: se testean sin base de datos.
 */
import { addDays } from "@/lib/dates";
import type { ClockPlace, ClockRecord } from "@/lib/fichajes";
import type { Role } from "@/lib/roles";
import { DEFAULT_RULES, DEFAULT_SHIFTS } from "@/lib/schedule/defaults";
import {
  DAYS_IN_WEEK,
  FREE,
  type AbsenceMap,
  type Code,
  type Demand,
  type Employee,
  type Grid,
  type Rules,
  type ShiftCatalog,
  type Slot,
} from "@/lib/schedule/types";

// ---------- Filas tal como llegan de Supabase ----------
export interface LocalRow {
  id: string;
  nombre: string;
  max_noches_seguidas: number;
  descanso_minimo_horas: number;
  min_dias_libres: number;
  horas_extra_max?: number;
  fichaje_activo?: boolean;
  /** Día en que se activó el fichaje (antes no se revisa). */
  fichaje_desde?: string | null;
  fichaje_margen_minutos?: number;
  fichaje_control?: ClockControl;
  fichaje_lat?: number | null;
  fichaje_lng?: number | null;
  fichaje_radio_m?: number;
  fichaje_ips?: string[];
  es_dueno?: boolean;
}

/** Cómo se controla desde dónde se ficha. */
export type ClockControl = "no" | "avisar" | "bloquear";
export interface PuestoRow {
  clave: string;
  nombre: string;
  color: number;
}
export interface EmpleadoRow {
  id: string;
  nombre: string;
  puesto: string;
  horas_contrato: number;
  telefono: string | null;
  token_acceso: string;
  activo: boolean;
  min_dias_libres?: number | null;
  max_cierres_seguidos?: number | null;
  prefiere_librar?: number[] | null;
  teletrabajo_dias?: number[] | null;
}
export interface DisponibilidadRow {
  empleado_id: string;
  dia: number;
  franja: Slot;
}
export interface DemandaRow {
  dia: number;
  franja: Slot;
  puesto: string;
  cantidad: number;
}
export interface TurnoRow {
  empleado_id: string;
  dia: number;
  franja: Slot;
}
export interface FranjaRow {
  franja: Slot;
  etiqueta: string;
  inicio: string;
  fin: string;
  inicio2?: string | null;
  fin2?: string | null;
  horas: number | string; // numeric llega como texto desde PostgREST
  cierre?: boolean;
  orden?: number;
  activa?: boolean;
}
export interface AusenciaRow {
  id: string;
  empleado_id: string;
  desde: string;
  hasta: string;
  motivo: AbsenceReason;
  nota?: string | null;
}
export type AbsenceReason = "vacaciones" | "baja" | "permiso" | "otro";

export const ABSENCE_LABELS: Record<AbsenceReason, string> = {
  vacaciones: "Vacaciones",
  baja: "Baja",
  permiso: "Permiso",
  otro: "Ausencia",
};

/** Copia publicada: { empleado_id: { "0": "M", ... } } */
export type Snapshot = Record<string, Record<string, Slot>>;

/** Ajustes del local que no son reglas del generador. */
export interface LocalSettings {
  clockIn: boolean;
  /** Minutos de margen antes de marcar un retraso o una salida temprana. */
  clockMarginMinutes: number;
  /** Desde qué día se ficha (YYYY-MM-DD) o null. */
  clockSince: string | null;
  /** Comprobar si se ficha en el local: no, avisar o no dejar. */
  clockControl: ClockControl;
  /** ¿Hay ubicación del local guardada? (las coordenadas no salen del servidor) */
  clockHasPlace: boolean;
  clockRadius: number;
  /** IPs de la wifi del local. */
  clockIps: string[];
}

/** Empleado con los datos que no necesita el generador pero sí la interfaz. */
export interface EmployeeRecord extends Employee {
  phone: string | null;
  token: string;
  /** Días (0 = lunes) en que puede fichar desde cualquier sitio. */
  remoteDays?: number[];
}

const emptyWeek = () => Array<boolean>(DAYS_IN_WEEK).fill(false);

/**
 * Filas de empleados → empleados del dominio. `slots` son los códigos de las
 * franjas del local: cada empleado tiene una semana (vacía si no marca nada) por franja.
 */
export function toEmployees(rows: EmpleadoRow[], availability: DisponibilidadRow[], slots: Slot[] = Object.keys(DEFAULT_SHIFTS)): EmployeeRecord[] {
  return rows.map((r) => {
    const av: Record<Slot, boolean[]> = Object.fromEntries(slots.map((s) => [s, emptyWeek()]));
    for (const a of availability) if (a.empleado_id === r.id) (av[a.franja] ??= emptyWeek())[a.dia] = true;
    return {
      id: r.id,
      name: r.nombre,
      role: r.puesto,
      contractHours: r.horas_contrato,
      availability: av,
      minDaysOff: r.min_dias_libres ?? null,
      maxConsecutiveClosings: r.max_cierres_seguidos ?? null,
      preferredDaysOff: r.prefiere_librar ?? [],
      phone: r.telefono,
      token: r.token_acceso,
      remoteDays: r.teletrabajo_dias ?? [],
    };
  });
}

export function toRoles(rows: PuestoRow[]): Role[] {
  return rows.map((r) => ({ key: r.clave, name: r.nombre, color: r.color }));
}

export function availabilityToRows(employeeId: string, availability: Record<Slot, boolean[]>): DisponibilidadRow[] {
  const rows: DisponibilidadRow[] = [];
  for (const [franja, week] of Object.entries(availability)) {
    week.forEach((ok, dia) => {
      if (ok) rows.push({ empleado_id: employeeId, dia, franja });
    });
  }
  return rows;
}

export function rowsToDemand(rows: DemandaRow[]): Demand {
  const demand: Demand = Array.from({ length: DAYS_IN_WEEK }, () => ({}));
  for (const r of rows) {
    const day = demand[r.dia];
    day[r.franja] = { ...(day[r.franja] ?? {}), [r.puesto]: r.cantidad };
  }
  return demand;
}

export function demandToRows(demand: Demand): DemandaRow[] {
  const rows: DemandaRow[] = [];
  demand.forEach((day, dia) => {
    for (const franja of Object.keys(day)) {
      for (const [puesto, cantidad] of Object.entries(day[franja] ?? {})) {
        if (cantidad > 0) rows.push({ dia, franja, puesto, cantidad });
      }
    }
  });
  return rows;
}

export function rowsToGrid(employeeIds: string[], turnos: TurnoRow[]): Grid {
  const grid: Grid = {};
  for (const id of employeeIds) grid[id] = Array<Code>(DAYS_IN_WEEK).fill(FREE);
  for (const t of turnos) if (grid[t.empleado_id]) grid[t.empleado_id][t.dia] = t.franja;
  return grid;
}

export function gridToTurnos(grid: Grid): TurnoRow[] {
  const rows: TurnoRow[] = [];
  for (const [empleado_id, codes] of Object.entries(grid)) {
    codes.forEach((c, dia) => {
      if (c !== FREE) rows.push({ empleado_id, dia, franja: c });
    });
  }
  return rows;
}

export function snapshotToGrid(employeeIds: string[], snapshot: Snapshot | null): Grid {
  const turnos: TurnoRow[] = [];
  for (const [empleado_id, days] of Object.entries(snapshot ?? {})) {
    for (const [dia, franja] of Object.entries(days)) turnos.push({ empleado_id, dia: Number(dia), franja });
  }
  return rowsToGrid(employeeIds, turnos);
}

/** Ausencias que tocan la semana → para cada empleado, el motivo de cada día (o null). */
export function absencesForWeek(rows: AusenciaRow[], monday: string): AbsenceMap {
  const map: AbsenceMap = {};
  const days = Array.from({ length: DAYS_IN_WEEK }, (_, i) => addDays(monday, i));
  for (const a of rows) {
    const week = (map[a.empleado_id] ??= Array<string | null>(DAYS_IN_WEEK).fill(null));
    days.forEach((iso, i) => {
      if (iso >= a.desde && iso <= a.hasta) week[i] = a.motivo;
    });
  }
  return map;
}

/** Franjas del local (activas y archivadas). Sin filas, las de por defecto. */
export function franjasToCatalog(rows: FranjaRow[]): ShiftCatalog {
  if (!rows.length) return { ...DEFAULT_SHIFTS };
  const catalog: ShiftCatalog = {};
  rows.forEach((r, i) => {
    catalog[r.franja] = {
      code: r.franja,
      label: r.etiqueta,
      start: r.inicio.slice(0, 5), // "09:00:00" → "09:00"
      end: r.fin.slice(0, 5),
      start2: r.inicio2 ? r.inicio2.slice(0, 5) : null,
      end2: r.fin2 ? r.fin2.slice(0, 5) : null,
      hours: Number(r.horas),
      closing: r.cierre ?? r.franja === "N",
      order: r.orden ?? i,
      active: r.activa ?? true,
    };
  });
  return catalog;
}

export function localToRules(local: LocalRow): Rules {
  return {
    maxConsecutiveNights: local.max_noches_seguidas ?? DEFAULT_RULES.maxConsecutiveNights,
    minRestHours: local.descanso_minimo_horas ?? DEFAULT_RULES.minRestHours,
    minDaysOff: local.min_dias_libres ?? DEFAULT_RULES.minDaysOff,
    maxExtraHours: local.horas_extra_max ?? DEFAULT_RULES.maxExtraHours,
  };
}

export function localToSettings(local: LocalRow): LocalSettings {
  return {
    clockIn: Boolean(local.fichaje_activo),
    clockMarginMinutes: local.fichaje_margen_minutos ?? 10,
    clockSince: local.fichaje_desde ?? null,
    clockControl: local.fichaje_control ?? "no",
    clockHasPlace: local.fichaje_lat != null && local.fichaje_lng != null,
    clockRadius: local.fichaje_radio_m ?? 200,
    clockIps: local.fichaje_ips ?? [],
  };
}

/** Fila de fichaje tal como llega de la base de datos. */
export interface FichajeRow {
  id: string;
  empleado_id: string;
  entrada: string;
  salida: string | null;
  sin_salida: boolean;
  editado: boolean;
  ubicacion_entrada?: ClockPlace | null;
  ubicacion_salida?: ClockPlace | null;
  distancia_entrada_m?: number | null;
  distancia_salida_m?: number | null;
}

export function toClockRecords(rows: FichajeRow[]): ClockRecord[] {
  return rows.map((f) => ({
    id: f.id,
    employeeId: f.empleado_id,
    start: f.entrada,
    end: f.salida,
    missingEnd: f.sin_salida,
    edited: f.editado,
    placeIn: f.ubicacion_entrada ?? null,
    placeOut: f.ubicacion_salida ?? null,
    distIn: f.distancia_entrada_m ?? null,
    distOut: f.distancia_salida_m ?? null,
  }));
}
