/**
 * Estado de la demo: el mismo negocio que crearía alguien al registrarse,
 * pero todo en memoria. Funciones puras (se pueden probar sin navegador).
 */
import type { AusenciaRow, EmployeeRecord, LocalSettings } from "@/lib/data/mappers";
import { addDays, mondayOf, todayInMadrid } from "@/lib/dates";
import type { ClockChange, ClockRecord } from "@/lib/fichajes";
import { madridToIso } from "@/lib/fichajes";
import type { Role } from "@/lib/roles";
import { DEFAULT_RULES } from "@/lib/schedule/defaults";
import { emptyGrid } from "@/lib/schedule/generator";
import { spanHours, toHours } from "@/lib/schedule/rules";
import { customShifts, getTemplate, templateDemand, templateRoles, templateShifts, templateTeam, type ShiftEdit } from "@/lib/schedule/templates";
import { activeSlots, FREE, type Demand, type Grid, type Rules, type ShiftCatalog } from "@/lib/schedule/types";

export type DemoTab = "cuadrante" | "fichajes" | "empleados" | "necesidades" | "ajustes";

export interface DemoState {
  name: string;
  tipo: string;
  roles: Role[];
  shifts: ShiftCatalog;
  demand: Demand;
  rules: Rules;
  settings: LocalSettings;
  employees: EmployeeRecord[];
  absences: AusenciaRow[];
  grid: Grid;
  status: "borrador" | "publicado" | "cambios";
  published: boolean;
  records: ClockRecord[];
  changes: ClockChange[];
  /** La demo transcurre en la semana actual; "hoy" es su jueves a las 18:30. */
  monday: string;
  today: string;
  now: string;
  seq: number;
}

/** Número pseudoaleatorio estable (la demo sale igual cada vez). */
function rand(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

const hex32 = (key: string) =>
  Array.from({ length: 4 }, (_, i) => Math.floor(rand(`${key}:${i}`) * 0xffffffff).toString(16).padStart(8, "0")).join("");

export function createDemoState(input: { nombre: string; tipo: string; puestos: string[]; franjas?: ShiftEdit[] }, realToday = todayInMadrid()): DemoState {
  const t = getTemplate(input.tipo);
  const roles = templateRoles(t, input.puestos);
  const shifts = input.franjas ? customShifts(t, input.franjas) : templateShifts(t);
  const monday = mondayOf(realToday);
  const today = addDays(monday, 3);
  const team = templateTeam(t, roles, shifts);
  const employees: EmployeeRecord[] = team.map((e, i) => ({ ...e, token: hex32(`${e.name}-${i}`), phone: e.phone }));
  const last = employees[employees.length - 1];
  return {
    name: input.nombre,
    tipo: input.tipo,
    roles,
    shifts,
    demand: templateDemand(t, roles, shifts),
    rules: { ...DEFAULT_RULES },
    settings: { clockIn: true, clockMarginMinutes: 10 },
    employees,
    // Alguien tiene vacaciones el fin de semana: el generador lo respeta.
    absences: last ? [{ id: "aus-1", empleado_id: last.id, desde: addDays(monday, 5), hasta: addDays(monday, 9), motivo: "vacaciones", nota: "Viaje" }] : [],
    grid: emptyGrid(employees),
    status: "borrador",
    published: false,
    records: [],
    changes: [],
    monday,
    today,
    now: madridToIso(today, "18:30"),
    seq: 1,
  };
}

/** Cada persona tiene su fila (las nuevas, libres) y no quedan filas de quien ya no está. */
export function normalizeGrid(grid: Grid, employees: EmployeeRecord[]): Grid {
  return Object.fromEntries(employees.map((e) => [e.id, grid[e.id] ?? Array(7).fill(FREE)]));
}

/**
 * Fichajes de ejemplo para lo que ya ha pasado de la semana, a partir del
 * cuadrante: casi todos puntuales, uno llega tarde, otro olvida fichar la
 * salida y otro no ficha un día. Así el encargado ve cómo se gestiona.
 */
export function simulateClock(state: DemoState, grid: Grid): ClockRecord[] {
  const records: ClockRecord[] = [];
  const nowMs = Date.parse(state.now);
  const shifted = (date: string, hhmm: string, minutes: number) => new Date(Date.parse(madridToIso(date, hhmm)) + minutes * 60_000).toISOString();
  let lateDone = false;
  let forgotDone = false;
  let missingDone = false;
  for (let d = 0; d <= 3; d++) {
    const date = addDays(state.monday, d);
    for (const e of state.employees) {
      const code = grid[e.id]?.[d];
      const s = code && code !== FREE ? state.shifts[code] : undefined;
      if (!s) continue;
      const key = `${e.id}:${date}`;
      if (!missingDone && d === 0 && rand(`m${key}`) < 0.35) {
        missingDone = true;
        continue; // no fichó
      }
      let inMin = Math.round(rand(`i${key}`) * 9) - 6; // de 6 min antes a 2 después
      if (!lateDone && d === 1 && rand(`l${key}`) < 0.5) {
        inMin = 22;
        lateDone = true;
      }
      const start = shifted(date, s.start, inMin);
      if (Date.parse(start) > nowMs) continue; // aún no ha empezado
      const endDate = toHours(s.end) <= toHours(s.start) ? addDays(date, 1) : date;
      const end = shifted(endDate, s.end, Math.round(rand(`o${key}`) * 8) - 2);
      const id = `rec-${records.length + 1}`;
      if (!forgotDone && d === 2) {
        forgotDone = true;
        records.push({ id, employeeId: e.id, start, end: null, missingEnd: true, edited: false });
      } else if (Date.parse(end) > nowMs) {
        records.push({ id, employeeId: e.id, start, end: null, missingEnd: false, edited: false });
      } else {
        records.push({ id, employeeId: e.id, start, end, missingEnd: false, edited: false });
      }
    }
  }
  return records;
}

/** Guarda las franjas como lo hace la base de datos: nuevas con todos disponibles, quitadas fuera. */
export function applyShifts(state: DemoState, rows: { code: string; label: string; start: string; end: string; closing: boolean }[], demand: Demand): DemoState {
  const used = new Set(Object.values(state.grid).flat());
  const keep = new Set(rows.map((r) => r.code));
  const shifts: ShiftCatalog = {};
  for (const [code, def] of Object.entries(state.shifts)) {
    if (!keep.has(code) && used.has(code)) shifts[code] = { ...def, active: false }; // archivada
  }
  rows.forEach((r, i) => {
    shifts[r.code] = { code: r.code, label: r.label.trim(), start: r.start, end: r.end, hours: spanHours(r.start, r.end), closing: r.closing, order: i, active: true };
  });
  const isNew = (code: string) => !state.shifts[code];
  const employees = state.employees.map((e) => ({
    ...e,
    availability: Object.fromEntries(activeSlots(shifts).map((c) => [c, isNew(c) ? Array(7).fill(true) : (e.availability[c] ?? Array(7).fill(false))])),
  }));
  const roleKeys = new Set(state.roles.map((r) => r.key));
  const cleanDemand = demand.map((day) =>
    Object.fromEntries(
      Object.entries(day)
        .filter(([slot]) => keep.has(slot))
        .map(([slot, byRole]) => [slot, Object.fromEntries(Object.entries(byRole ?? {}).filter(([role, n]) => roleKeys.has(role) && n > 0))]),
    ),
  );
  return { ...state, shifts, employees, demand: cleanDemand };
}
