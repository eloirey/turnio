/**
 * Traducción entre las filas de la base de datos (en castellano, una fila por
 * dato) y los tipos del dominio que usa el generador (en inglés, estructuras).
 * Son funciones puras: se testean sin base de datos.
 */
import { DEFAULT_RULES, DEFAULT_SHIFTS } from "@/lib/schedule/defaults";
import {
  DAYS_IN_WEEK,
  SLOTS,
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
  prohibir_noche_manana: boolean;
}
export interface EmpleadoRow {
  id: string;
  nombre: string;
  puesto: string;
  horas_contrato: number;
  telefono: string | null;
  token_acceso: string;
  activo: boolean;
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
  horas: number | string; // numeric llega como texto desde PostgREST
}
/** Copia publicada: { empleado_id: { "0": "M", ... } } */
export type Snapshot = Record<string, Record<string, Slot>>;

/** Empleado con los datos que no necesita el generador pero sí la interfaz. */
export interface EmployeeRecord extends Employee {
  phone: string | null;
  token: string;
}

const emptyWeek = () => Array<boolean>(DAYS_IN_WEEK).fill(false);

export function toEmployees(rows: EmpleadoRow[], availability: DisponibilidadRow[]): EmployeeRecord[] {
  return rows.map((r) => {
    const av: Record<Slot, boolean[]> = { M: emptyWeek(), T: emptyWeek(), N: emptyWeek() };
    for (const a of availability) if (a.empleado_id === r.id) av[a.franja][a.dia] = true;
    return {
      id: r.id,
      name: r.nombre,
      role: r.puesto,
      contractHours: r.horas_contrato,
      availability: av,
      phone: r.telefono,
      token: r.token_acceso,
    };
  });
}

export function availabilityToRows(employeeId: string, availability: Record<Slot, boolean[]>): DisponibilidadRow[] {
  const rows: DisponibilidadRow[] = [];
  for (const franja of SLOTS) {
    availability[franja].forEach((ok, dia) => {
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
    for (const franja of SLOTS) {
      for (const [puesto, cantidad] of Object.entries(day[franja] ?? {})) {
        if (cantidad > 0) rows.push({ dia, franja, puesto, cantidad });
      }
    }
  });
  return rows;
}

export function rowsToGrid(employeeIds: string[], turnos: TurnoRow[]): Grid {
  const grid: Grid = {};
  for (const id of employeeIds) grid[id] = Array<Code>(DAYS_IN_WEEK).fill("L");
  for (const t of turnos) if (grid[t.empleado_id]) grid[t.empleado_id][t.dia] = t.franja;
  return grid;
}

export function gridToTurnos(grid: Grid): TurnoRow[] {
  const rows: TurnoRow[] = [];
  for (const [empleado_id, codes] of Object.entries(grid)) {
    codes.forEach((c, dia) => {
      if (c !== "L") rows.push({ empleado_id, dia, franja: c });
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

export function franjasToCatalog(rows: FranjaRow[]): ShiftCatalog {
  const catalog: ShiftCatalog = { ...DEFAULT_SHIFTS };
  for (const r of rows) {
    catalog[r.franja] = {
      code: r.franja,
      label: r.etiqueta,
      start: r.inicio.slice(0, 5), // "09:00:00" → "09:00"
      end: r.fin.slice(0, 5),
      hours: Number(r.horas),
    };
  }
  return catalog;
}

export function localToRules(local: LocalRow): Rules {
  return {
    maxConsecutiveNights: local.max_noches_seguidas ?? DEFAULT_RULES.maxConsecutiveNights,
    forbidNightThenMorning: local.prohibir_noche_manana ?? DEFAULT_RULES.forbidNightThenMorning,
  };
}
