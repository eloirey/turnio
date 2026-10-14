import { DEFAULT_RULES, DEFAULT_SHIFTS } from "./defaults";
import { rowIsValid } from "./rules";
import {
  DAYS_IN_WEEK,
  type AbsenceMap,
  type Demand,
  type Employee,
  type Grid,
  type Rules,
  type ShiftCatalog,
  type Slot,
} from "./types";

interface Need {
  day: number;
  slot: Slot;
  role: string;
}

export function emptyGrid(employees: Employee[]): Grid {
  const grid: Grid = {};
  for (const e of employees) grid[e.id] = Array(DAYS_IN_WEEK).fill("L");
  return grid;
}

/** Convierte la demanda en una lista plana de "plazas" a cubrir (una por persona). */
export function expandDemand(demand: Demand): Need[] {
  const needs: Need[] = [];
  demand.forEach((dayDemand, day) => {
    for (const slot of Object.keys(dayDemand) as Slot[]) {
      const byRole = dayDemand[slot] ?? {};
      for (const [role, count] of Object.entries(byRole)) {
        for (let k = 0; k < count; k++) needs.push({ day, slot, role });
      }
    }
  });
  return needs;
}

export function isAbsent(absences: AbsenceMap, employeeId: string, day: number): boolean {
  return Boolean(absences[employeeId]?.[day]);
}

/**
 * Generador voraz (greedy) de cuadrantes.
 *
 *  1. Lista todas las plazas a cubrir (expandDemand).
 *  2. Las ordena de MÁS DIFÍCIL a más fácil: primero las que menos empleados
 *     pueden cubrir. Si dejáramos para el final una plaza que solo puede
 *     cubrir una persona, quizá esa persona ya estaría llena.
 *  3. Para cada plaza elige, entre los candidatos válidos, al que lleve menos
 *     horas en proporción a su contrato; a igualdad, al que lleve menos noches
 *     y menos fines de semana (reparto justo de lo que nadie quiere).
 *
 * Un candidato es válido si: tiene el puesto, está disponible, no está de
 * ausencia, ese día aún libra, no supera su contrato y no rompe ninguna regla
 * (descanso mínimo, noches seguidas, días libres).
 *
 * No garantiza la solución óptima (eso sería un problema de satisfacción de
 * restricciones), pero es rápido, predecible y suficiente. Las plazas que no
 * se pueden cubrir quedan como huecos que el validador avisa.
 */
export function generateSchedule(
  employees: Employee[],
  demand: Demand,
  shifts: ShiftCatalog = DEFAULT_SHIFTS,
  rules: Rules = DEFAULT_RULES,
  absences: AbsenceMap = {},
): Grid {
  const grid = emptyGrid(employees);
  const hours = new Map(employees.map((e) => [e.id, 0]));
  const nights = new Map(employees.map((e) => [e.id, 0]));
  const weekends = new Map(employees.map((e) => [e.id, 0]));

  const canWorkAtAll = (e: Employee, n: Need) =>
    e.role === n.role && e.availability[n.slot][n.day] === true && !isAbsent(absences, e.id, n.day);

  const needs = expandDemand(demand);
  const eligibleCount = new Map(needs.map((n) => [n, employees.filter((e) => canWorkAtAll(e, n)).length]));
  needs.sort((a, b) => eligibleCount.get(a)! - eligibleCount.get(b)! || a.day - b.day);

  for (const need of needs) {
    const shiftHours = shifts[need.slot].hours;
    const candidates = employees.filter((e) => {
      if (!canWorkAtAll(e, need)) return false;
      if (grid[e.id][need.day] !== "L") return false;
      if (hours.get(e.id)! + shiftHours > e.contractHours) return false;
      const row = [...grid[e.id]];
      row[need.day] = need.slot;
      return rowIsValid(row, shifts, rules);
    });
    if (candidates.length === 0) continue; // queda como hueco

    candidates.sort(
      (a, b) =>
        hours.get(a.id)! / a.contractHours - hours.get(b.id)! / b.contractHours ||
        nights.get(a.id)! - nights.get(b.id)! ||
        weekends.get(a.id)! - weekends.get(b.id)!,
    );
    const chosen = candidates[0];
    grid[chosen.id][need.day] = need.slot;
    hours.set(chosen.id, hours.get(chosen.id)! + shiftHours);
    if (need.slot === "N") nights.set(chosen.id, nights.get(chosen.id)! + 1);
    if (need.day >= 5) weekends.set(chosen.id, weekends.get(chosen.id)! + 1);
  }

  return grid;
}
